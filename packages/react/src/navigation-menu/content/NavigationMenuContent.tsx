'use client';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { inertValue } from '@base-ui-components/utils/inertValue';
import { FloatingNode } from '../../floating-ui-react';
import { contains } from '../../floating-ui-react/utils';
import type { BaseUIComponentProps, HTMLProps } from '../../utils/types';
import {
  useNavigationMenuRootContext,
  useNavigationMenuTreeContext,
} from '../root/NavigationMenuRootContext';
import { useNavigationMenuItemContext } from '../item/NavigationMenuItemContext';
import { TransitionStatus, useTransitionStatus } from '../../utils/useTransitionStatus';
import { useOpenChangeComplete } from '../../utils/useOpenChangeComplete';
import { transitionStatusMapping } from '../../utils/styleHookMapping';
import { CustomStyleHookMapping } from '../../utils/getStyleHookProps';
import { CompositeRoot } from '../../composite/root/CompositeRoot';
import { popupStateMapping } from '../../utils/popupStateMapping';

const customStyleHookMapping: CustomStyleHookMapping<NavigationMenuContent.State> = {
  ...popupStateMapping,
  ...transitionStatusMapping,
  activationDirection(value) {
    if (!value) {
      return null;
    }
    return {
      'data-activation-direction': value,
    };
  },
};

/**
 * A container for the content of the navigation menu item that is moved into the popup
 * when the item is active.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export const NavigationMenuContent = React.forwardRef(function NavigationMenuContent(
  componentProps: NavigationMenuContent.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { className, render, ...elementProps } = componentProps;

  const {
    mounted: popupMounted,
    viewportElement,
    value,
    activationDirection,
    currentContentRef,
    viewportTargetElement,
  } = useNavigationMenuRootContext();
  const itemValue = useNavigationMenuItemContext();
  const nodeId = useNavigationMenuTreeContext();

  const open = popupMounted && value === itemValue;

  const ref = React.useRef<HTMLDivElement | null>(null);

  const [focusInside, setFocusInside] = React.useState(false);

  const { mounted, setMounted, transitionStatus } = useTransitionStatus(open);

  useOpenChangeComplete({
    ref,
    open,
    onComplete() {
      if (!open) {
        setMounted(false);
      }
    },
  });

  const state: NavigationMenuContent.State = React.useMemo(
    () => ({
      open,
      transitionStatus,
      activationDirection,
    }),
    [open, transitionStatus, activationDirection],
  );

  const handleCurrentContentRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        currentContentRef.current = node;
      }
    },
    [currentContentRef],
  );

  const commonProps: HTMLProps = {
    onFocus() {
      setFocusInside(true);
    },
    onBlur(event) {
      if (!contains(event.currentTarget, event.relatedTarget)) {
        setFocusInside(false);
      }
    },
  };

  const defaultProps: HTMLProps =
    !open && mounted
      ? {
          style: { position: 'absolute', top: 0, left: 0 },
          inert: inertValue(!focusInside),
          ...commonProps,
        }
      : commonProps;

  const portalContainer = viewportTargetElement || viewportElement;
  const shouldRender = portalContainer !== null && mounted;

  if (!portalContainer || !shouldRender) {
    return null;
  }

  return ReactDOM.createPortal(
    <FloatingNode id={nodeId}>
      <CompositeRoot
        render={render}
        className={className}
        state={state}
        refs={[forwardedRef, ref, handleCurrentContentRef]}
        props={[defaultProps, elementProps]}
        customStyleHookMapping={customStyleHookMapping}
        stopEventPropagation
      />
    </FloatingNode>,
    portalContainer,
  );
});

export namespace NavigationMenuContent {
  export interface State {
    /**
     * If `true`, the component is open.
     */
    open: boolean;
    /**
     * The transition status of the component.
     */
    transitionStatus: TransitionStatus;
    /**
     * The direction of the activation.
     */
    activationDirection: 'left' | 'right' | 'up' | 'down' | null;
  }

  export interface Props extends BaseUIComponentProps<'div', State> {}
}
