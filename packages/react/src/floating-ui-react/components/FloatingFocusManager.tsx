import * as React from 'react';
import { tabbable, isTabbable, focusable, type FocusableElement } from 'tabbable';
import { getNodeName, isHTMLElement } from '@floating-ui/utils/dom';
import { useMergedRefs } from '@base-ui-components/utils/useMergedRefs';
import { useLatestRef } from '@base-ui-components/utils/useLatestRef';
import { useEventCallback } from '@base-ui-components/utils/useEventCallback';
import { useIsoLayoutEffect } from '@base-ui-components/utils/useIsoLayoutEffect';
import { visuallyHidden } from '@base-ui-components/utils/visuallyHidden';
import { useTimeout } from '@base-ui-components/utils/useTimeout';
import { FocusGuard } from '../../utils/FocusGuard';
import {
  activeElement,
  contains,
  getDocument,
  getTarget,
  isTypeableCombobox,
  isVirtualClick,
  isVirtualPointerEvent,
  stopEvent,
  getNodeAncestors,
  getNodeChildren,
  getFloatingFocusElement,
  getTabbableOptions,
  isOutsideEvent,
  getNextTabbable,
  getPreviousTabbable,
} from '../utils';
import type { FloatingRootContext, OpenChangeReason } from '../types';
import { createAttribute } from '../utils/createAttribute';
import { enqueueFocus } from '../utils/enqueueFocus';
import { markOthers } from '../utils/markOthers';
import { usePortalContext } from './FloatingPortal';
import { useFloatingTree } from './FloatingTree';
import { CLICK_TRIGGER_IDENTIFIER } from '../../utils/constants';

const LIST_LIMIT = 20;
let previouslyFocusedElements: Element[] = [];

function clearDisconnectedPreviouslyFocusedElements() {
  previouslyFocusedElements = previouslyFocusedElements.filter((el) => el.isConnected);
}

function addPreviouslyFocusedElement(element: Element | null) {
  clearDisconnectedPreviouslyFocusedElements();
  if (element && getNodeName(element) !== 'body') {
    previouslyFocusedElements.push(element);
    if (previouslyFocusedElements.length > LIST_LIMIT) {
      previouslyFocusedElements = previouslyFocusedElements.slice(-LIST_LIMIT);
    }
  }
}

function getPreviouslyFocusedElement() {
  clearDisconnectedPreviouslyFocusedElements();
  return previouslyFocusedElements[previouslyFocusedElements.length - 1];
}

function getFirstTabbableElement(container: Element) {
  const tabbableOptions = getTabbableOptions();
  if (isTabbable(container, tabbableOptions)) {
    return container;
  }

  return tabbable(container, tabbableOptions)[0] || container;
}

function handleTabIndex(
  floatingFocusElement: HTMLElement,
  orderRef: React.RefObject<Array<'reference' | 'floating' | 'content'>>,
) {
  if (
    !orderRef.current.includes('floating') &&
    !floatingFocusElement.getAttribute('role')?.includes('dialog')
  ) {
    return;
  }

  const options = getTabbableOptions();
  const focusableElements = focusable(floatingFocusElement, options);
  const tabbableContent = focusableElements.filter((element) => {
    const dataTabIndex = element.getAttribute('data-tabindex') || '';
    return (
      isTabbable(element, options) ||
      (element.hasAttribute('data-tabindex') && !dataTabIndex.startsWith('-'))
    );
  });
  const tabIndex = floatingFocusElement.getAttribute('tabindex');

  if (orderRef.current.includes('floating') || tabbableContent.length === 0) {
    if (tabIndex !== '0') {
      floatingFocusElement.setAttribute('tabindex', '0');
    }
  } else if (
    tabIndex !== '-1' ||
    (floatingFocusElement.hasAttribute('data-tabindex') &&
      floatingFocusElement.getAttribute('data-tabindex') !== '-1')
  ) {
    floatingFocusElement.setAttribute('tabindex', '-1');
    floatingFocusElement.setAttribute('data-tabindex', '-1');
  }
}

export interface FloatingFocusManagerProps {
  children: React.JSX.Element;
  /**
   * The floating context returned from `useFloatingRootContext`.
   */
  context: FloatingRootContext;
  /**
   * Whether or not the focus manager should be disabled. Useful to delay focus
   * management until after a transition completes or some other conditional
   * state.
   * @default false
   */
  disabled?: boolean;
  /**
   * The order in which focus cycles.
   * @default ['content']
   */
  order?: Array<'reference' | 'floating' | 'content'>;
  /**
   * Which element to initially focus. Can be either a number (tabbable index as
   * specified by the `order`) or a ref.
   * @default 0
   */
  initialFocus?: number | React.RefObject<HTMLElement | null>;
  /**
   * Determines if focus should be returned to the reference element once the
   * floating element closes/unmounts (or if that is not available, the
   * previously focused element). This prop is ignored if the floating element
   * lost focus.
   * It can be also set to a ref to explicitly control the element to return focus to.
   * @default true
   */
  returnFocus?: boolean | React.RefObject<HTMLElement | null>;
  /**
   * Determines if focus should be restored to the nearest tabbable element if
   * focus inside the floating element is lost (such as due to the removal of
   * the currently focused element from the DOM).
   * @default false
   */
  restoreFocus?: boolean;
  /**
   * Determines if focus is “modal”, meaning focus is fully trapped inside the
   * floating element and outside content cannot be accessed. This includes
   * screen reader virtual cursors.
   * @default true
   */
  modal?: boolean;
  /**
   * Determines whether `focusout` event listeners that control whether the
   * floating element should be closed if the focus moves outside of it are
   * attached to the reference and floating elements. This affects non-modal
   * focus management.
   * @default true
   */
  closeOnFocusOut?: boolean;
  /**
   * Returns a list of elements that should be considered part of the
   * floating element.
   */
  getInsideElements?: () => Element[];
}

/**
 * Provides focus management for the floating element.
 * @see https://floating-ui.com/docs/FloatingFocusManager
 * @internal
 */
export function FloatingFocusManager(props: FloatingFocusManagerProps): React.JSX.Element {
  const {
    context,
    children,
    disabled = false,
    order = ['content'],
    initialFocus = 0,
    returnFocus = true,
    restoreFocus = false,
    modal = true,
    closeOnFocusOut = true,
    getInsideElements: getInsideElementsProp = () => [],
  } = props;
  const {
    open,
    onOpenChange,
    events,
    dataRef,
    elements: { domReference, floating },
  } = context;

  const getNodeId = useEventCallback(() => dataRef.current.floatingContext?.nodeId);
  const getInsideElements = useEventCallback(getInsideElementsProp);

  const ignoreInitialFocus = typeof initialFocus === 'number' && initialFocus < 0;
  // If the reference is a combobox and is typeable (e.g. input/textarea),
  // there are different focus semantics. The guards should not be rendered, but
  // aria-hidden should be applied to all nodes still. Further, the visually
  // hidden dismiss button should only appear at the end of the list, not the
  // start.
  const isUntrappedTypeableCombobox = isTypeableCombobox(domReference) && ignoreInitialFocus;

  const orderRef = useLatestRef(order);
  const initialFocusRef = useLatestRef(initialFocus);
  const returnFocusRef = useLatestRef(returnFocus);

  const tree = useFloatingTree();
  const portalContext = usePortalContext();

  const startDismissButtonRef = React.useRef<HTMLButtonElement>(null);
  const endDismissButtonRef = React.useRef<HTMLButtonElement>(null);
  const preventReturnFocusRef = React.useRef(false);
  const isPointerDownRef = React.useRef(false);
  const tabbableIndexRef = React.useRef(-1);

  const blurTimeout = useTimeout();

  const isInsidePortal = portalContext != null;
  const floatingFocusElement = getFloatingFocusElement(floating);

  const getTabbableContent = useEventCallback(
    (container: Element | null = floatingFocusElement) => {
      return container ? tabbable(container, getTabbableOptions()) : [];
    },
  );

  const getTabbableElements = useEventCallback((container?: Element) => {
    const content = getTabbableContent(container);

    return orderRef.current
      .map(() => content)
      .filter(Boolean)
      .flat() as Array<FocusableElement>;
  });

  React.useEffect(() => {
    if (disabled) {
      return undefined;
    }
    if (!modal) {
      return undefined;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Tab') {
        // The focus guards have nothing to focus, so we need to stop the event.
        if (
          contains(floatingFocusElement, activeElement(getDocument(floatingFocusElement))) &&
          getTabbableContent().length === 0 &&
          !isUntrappedTypeableCombobox
        ) {
          stopEvent(event);
        }
      }
    }

    const doc = getDocument(floatingFocusElement);
    doc.addEventListener('keydown', onKeyDown);
    return () => {
      doc.removeEventListener('keydown', onKeyDown);
    };
  }, [
    disabled,
    domReference,
    floatingFocusElement,
    modal,
    orderRef,
    isUntrappedTypeableCombobox,
    getTabbableContent,
    getTabbableElements,
  ]);

  React.useEffect(() => {
    if (disabled) {
      return undefined;
    }
    if (!floating) {
      return undefined;
    }

    function handleFocusIn(event: FocusEvent) {
      const target = getTarget(event) as Element | null;
      const tabbableContent = getTabbableContent() as Array<Element | null>;
      const tabbableIndex = tabbableContent.indexOf(target);
      if (tabbableIndex !== -1) {
        tabbableIndexRef.current = tabbableIndex;
      }
    }

    floating.addEventListener('focusin', handleFocusIn);

    return () => {
      floating.removeEventListener('focusin', handleFocusIn);
    };
  }, [disabled, floating, getTabbableContent]);

  React.useEffect(() => {
    if (disabled) {
      return undefined;
    }
    if (!closeOnFocusOut) {
      return undefined;
    }

    // In Safari, buttons lose focus when pressing them.
    function handlePointerDown() {
      isPointerDownRef.current = true;
    }

    function handleFocusOutside(event: FocusEvent) {
      const relatedTarget = event.relatedTarget as HTMLElement | null;
      const currentTarget = event.currentTarget;
      const target = getTarget(event) as HTMLElement | null;

      queueMicrotask(() => {
        const nodeId = getNodeId();
        const movedToUnrelatedNode = !(
          contains(domReference, relatedTarget) ||
          contains(floating, relatedTarget) ||
          contains(relatedTarget, floating) ||
          contains(portalContext?.portalNode, relatedTarget) ||
          relatedTarget?.hasAttribute(createAttribute('focus-guard')) ||
          (tree &&
            (getNodeChildren(tree.nodesRef.current, nodeId).find(
              (node) =>
                contains(node.context?.elements.floating, relatedTarget) ||
                contains(node.context?.elements.domReference, relatedTarget),
            ) ||
              getNodeAncestors(tree.nodesRef.current, nodeId).find(
                (node) =>
                  [
                    node.context?.elements.floating,
                    getFloatingFocusElement(node.context?.elements.floating),
                  ].includes(relatedTarget) ||
                  node.context?.elements.domReference === relatedTarget,
              )))
        );

        if (currentTarget === domReference && floatingFocusElement) {
          handleTabIndex(floatingFocusElement, orderRef);
        }

        // Restore focus to the previous tabbable element index to prevent
        // focus from being lost outside the floating tree.
        if (
          restoreFocus &&
          currentTarget !== domReference &&
          !target?.isConnected &&
          activeElement(getDocument(floatingFocusElement)) ===
            getDocument(floatingFocusElement).body
        ) {
          // Let `FloatingPortal` effect knows that focus is still inside the
          // floating tree.
          if (isHTMLElement(floatingFocusElement)) {
            floatingFocusElement.focus();
          }

          const prevTabbableIndex = tabbableIndexRef.current;
          const tabbableContent = getTabbableContent() as Array<Element | null>;
          const nodeToFocus =
            tabbableContent[prevTabbableIndex] ||
            tabbableContent[tabbableContent.length - 1] ||
            floatingFocusElement;

          if (isHTMLElement(nodeToFocus)) {
            nodeToFocus.focus();
          }
        }

        // https://github.com/floating-ui/floating-ui/issues/3060
        if (dataRef.current.insideReactTree) {
          dataRef.current.insideReactTree = false;
          return;
        }

        if (isPointerDownRef.current) {
          isPointerDownRef.current = false;
          return;
        }

        // Focus did not move inside the floating tree, and there are no tabbable
        // portal guards to handle closing.
        if (
          (isUntrappedTypeableCombobox ? true : !modal) &&
          relatedTarget &&
          movedToUnrelatedNode &&
          // Fix React 18 Strict Mode returnFocus due to double rendering.
          relatedTarget !== getPreviouslyFocusedElement()
        ) {
          preventReturnFocusRef.current = true;
          onOpenChange(false, event, 'focus-out');
        }
      });
    }

    const shouldHandleBlurCapture = Boolean(!tree && portalContext);

    function markInsideReactTree() {
      dataRef.current.insideReactTree = true;
      blurTimeout.start(0, () => {
        dataRef.current.insideReactTree = false;
      });
    }

    if (floating && isHTMLElement(domReference)) {
      domReference.addEventListener('focusout', handleFocusOutside);
      domReference.addEventListener('pointerdown', handlePointerDown);
      floating.addEventListener('focusout', handleFocusOutside);

      if (shouldHandleBlurCapture) {
        floating.addEventListener('focusout', markInsideReactTree, true);
      }

      return () => {
        domReference.removeEventListener('focusout', handleFocusOutside);
        domReference.removeEventListener('pointerdown', handlePointerDown);
        floating.removeEventListener('focusout', handleFocusOutside);

        if (shouldHandleBlurCapture) {
          floating.removeEventListener('focusout', markInsideReactTree, true);
        }
      };
    }
    return undefined;
  }, [
    disabled,
    domReference,
    floating,
    floatingFocusElement,
    modal,
    tree,
    portalContext,
    onOpenChange,
    closeOnFocusOut,
    restoreFocus,
    getTabbableContent,
    isUntrappedTypeableCombobox,
    getNodeId,
    orderRef,
    dataRef,
    blurTimeout,
  ]);

  const beforeGuardRef = React.useRef<HTMLSpanElement | null>(null);
  const afterGuardRef = React.useRef<HTMLSpanElement | null>(null);

  const mergedBeforeGuardRef = useMergedRefs(beforeGuardRef, portalContext?.beforeInsideRef);
  const mergedAfterGuardRef = useMergedRefs(afterGuardRef, portalContext?.afterInsideRef);

  React.useEffect(() => {
    if (disabled) {
      return undefined;
    }
    if (!floating) {
      return undefined;
    }

    // Don't hide portals nested within the parent portal.
    const portalNodes = Array.from(
      portalContext?.portalNode?.querySelectorAll(`[${createAttribute('portal')}]`) || [],
    );

    const ancestors = tree ? getNodeAncestors(tree.nodesRef.current, getNodeId()) : [];
    const rootAncestorComboboxDomReference = ancestors.find((node) =>
      isTypeableCombobox(node.context?.elements.domReference || null),
    )?.context?.elements.domReference;

    const insideElements = [
      floating,
      rootAncestorComboboxDomReference,
      ...portalNodes,
      ...getInsideElements(),
      startDismissButtonRef.current,
      endDismissButtonRef.current,
      beforeGuardRef.current,
      afterGuardRef.current,
      portalContext?.beforeOutsideRef.current,
      portalContext?.afterOutsideRef.current,
      isUntrappedTypeableCombobox ? domReference : null,
    ].filter((x): x is Element => x != null);

    const cleanup = markOthers(insideElements, modal || isUntrappedTypeableCombobox);

    return () => {
      cleanup();
    };
  }, [
    disabled,
    domReference,
    floating,
    modal,
    orderRef,
    portalContext,
    isUntrappedTypeableCombobox,
    tree,
    getNodeId,
    getInsideElements,
  ]);

  useIsoLayoutEffect(() => {
    if (disabled || !isHTMLElement(floatingFocusElement)) {
      return;
    }

    const doc = getDocument(floatingFocusElement);
    const previouslyFocusedElement = activeElement(doc);

    // Wait for any layout effect state setters to execute to set `tabIndex`.
    queueMicrotask(() => {
      const focusableElements = getTabbableElements(floatingFocusElement);
      const initialFocusValue = initialFocusRef.current;
      const elToFocus =
        (typeof initialFocusValue === 'number'
          ? focusableElements[initialFocusValue]
          : initialFocusValue.current) || floatingFocusElement;
      const focusAlreadyInsideFloatingEl = contains(floatingFocusElement, previouslyFocusedElement);

      if (!ignoreInitialFocus && !focusAlreadyInsideFloatingEl && open) {
        enqueueFocus(elToFocus, {
          preventScroll: elToFocus === floatingFocusElement,
        });
      }
    });
  }, [
    disabled,
    open,
    floatingFocusElement,
    ignoreInitialFocus,
    getTabbableElements,
    initialFocusRef,
  ]);

  useIsoLayoutEffect(() => {
    if (disabled || !floatingFocusElement) {
      return undefined;
    }

    const doc = getDocument(floatingFocusElement);
    const previouslyFocusedElement = activeElement(doc);

    addPreviouslyFocusedElement(previouslyFocusedElement);

    // Dismissing via outside press should always ignore `returnFocus` to
    // prevent unwanted scrolling.
    function onOpenChangeLocal({
      reason,
      event,
      nested,
    }: {
      open: boolean;
      reason: OpenChangeReason;
      event: Event;
      nested: boolean;
    }) {
      if (['hover', 'safe-polygon'].includes(reason) && event.type === 'mouseleave') {
        preventReturnFocusRef.current = true;
      }

      if (reason !== 'outside-press') {
        return;
      }

      if (nested) {
        preventReturnFocusRef.current = false;
      } else if (
        isVirtualClick(event as MouseEvent) ||
        isVirtualPointerEvent(event as PointerEvent)
      ) {
        preventReturnFocusRef.current = false;
      } else {
        let isPreventScrollSupported = false;
        document.createElement('div').focus({
          get preventScroll() {
            isPreventScrollSupported = true;
            return false;
          },
        });

        if (isPreventScrollSupported) {
          preventReturnFocusRef.current = false;
        } else {
          preventReturnFocusRef.current = true;
        }
      }
    }

    events.on('openchange', onOpenChangeLocal);

    const fallbackEl = doc.createElement('span');
    fallbackEl.setAttribute('tabindex', '-1');
    fallbackEl.setAttribute('aria-hidden', 'true');
    Object.assign(fallbackEl.style, visuallyHidden);

    if (isInsidePortal && domReference) {
      domReference.insertAdjacentElement('afterend', fallbackEl);
    }

    function getReturnElement() {
      if (typeof returnFocusRef.current === 'boolean') {
        const el = domReference || getPreviouslyFocusedElement();
        return el && el.isConnected ? el : fallbackEl;
      }

      return returnFocusRef.current.current || fallbackEl;
    }

    return () => {
      events.off('openchange', onOpenChangeLocal);

      const activeEl = activeElement(doc);
      const isFocusInsideFloatingTree =
        contains(floating, activeEl) ||
        (tree &&
          getNodeChildren(tree.nodesRef.current, getNodeId(), false).some((node) =>
            contains(node.context?.elements.floating, activeEl),
          ));

      const returnElement = getReturnElement();

      queueMicrotask(() => {
        // This is `returnElement`, if it's tabbable, or its first tabbable child.
        const tabbableReturnElement = getFirstTabbableElement(returnElement);
        if (
          // eslint-disable-next-line react-hooks/exhaustive-deps
          returnFocusRef.current &&
          !preventReturnFocusRef.current &&
          isHTMLElement(tabbableReturnElement) &&
          // If the focus moved somewhere else after mount, avoid returning focus
          // since it likely entered a different element which should be
          // respected: https://github.com/floating-ui/floating-ui/issues/2607
          (tabbableReturnElement !== activeEl && activeEl !== doc.body
            ? isFocusInsideFloatingTree
            : true)
        ) {
          tabbableReturnElement.focus({ preventScroll: true });
        }

        fallbackEl.remove();
      });
    };
  }, [
    disabled,
    floating,
    floatingFocusElement,
    returnFocusRef,
    dataRef,
    events,
    tree,
    isInsidePortal,
    domReference,
    getNodeId,
  ]);

  React.useEffect(() => {
    // The `returnFocus` cleanup behavior is inside a microtask; ensure we
    // wait for it to complete before resetting the flag.
    queueMicrotask(() => {
      preventReturnFocusRef.current = false;
    });
  }, [disabled]);

  React.useEffect(() => {
    if (disabled || !open) {
      return undefined;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = getTarget(event) as Element | null;
      if (target?.closest(`[${CLICK_TRIGGER_IDENTIFIER}]`)) {
        isPointerDownRef.current = true;
      }
    }

    const doc = getDocument(floatingFocusElement);
    doc.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      doc.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [disabled, open, floatingFocusElement]);

  // Synchronize the `context` & `modal` value to the FloatingPortal context.
  // It will decide whether or not it needs to render its own guards.
  useIsoLayoutEffect(() => {
    if (disabled) {
      return undefined;
    }
    if (!portalContext) {
      return undefined;
    }

    portalContext.setFocusManagerState({
      modal,
      closeOnFocusOut,
      open,
      onOpenChange,
      domReference,
    });

    return () => {
      portalContext.setFocusManagerState(null);
    };
  }, [disabled, portalContext, modal, open, onOpenChange, closeOnFocusOut, domReference]);

  useIsoLayoutEffect(() => {
    if (disabled || !floatingFocusElement) {
      return undefined;
    }
    handleTabIndex(floatingFocusElement, orderRef);
    return () => {
      queueMicrotask(clearDisconnectedPreviouslyFocusedElements);
    };
  }, [disabled, floatingFocusElement, orderRef]);

  const shouldRenderGuards =
    !disabled && (modal ? !isUntrappedTypeableCombobox : true) && (isInsidePortal || modal);

  return (
    <React.Fragment>
      {shouldRenderGuards && (
        <FocusGuard
          data-type="inside"
          ref={mergedBeforeGuardRef}
          onFocus={(event) => {
            if (modal) {
              const els = getTabbableElements();
              enqueueFocus(els[els.length - 1]);
            } else if (portalContext?.preserveTabOrder && portalContext.portalNode) {
              preventReturnFocusRef.current = false;
              if (isOutsideEvent(event, portalContext.portalNode)) {
                const nextTabbable = getNextTabbable(domReference);
                nextTabbable?.focus();
              } else {
                portalContext.beforeOutsideRef.current?.focus();
              }
            }
          }}
        />
      )}
      {children}
      {shouldRenderGuards && (
        <FocusGuard
          data-type="inside"
          ref={mergedAfterGuardRef}
          onFocus={(event) => {
            if (modal) {
              enqueueFocus(getTabbableElements()[0]);
            } else if (portalContext?.preserveTabOrder && portalContext.portalNode) {
              if (closeOnFocusOut) {
                preventReturnFocusRef.current = true;
              }

              if (isOutsideEvent(event, portalContext.portalNode)) {
                const prevTabbable = getPreviousTabbable(domReference);
                prevTabbable?.focus();
              } else {
                portalContext.afterOutsideRef.current?.focus();
              }
            }
          }}
        />
      )}
    </React.Fragment>
  );
}
