import * as React from 'react';
import { expect } from 'chai';
import { act, flushMicrotasks, waitFor, screen, fireEvent } from '@mui/internal-test-utils';
import { DirectionProvider } from '@base-ui-components/react/direction-provider';
import { Menu } from '@base-ui-components/react/menu';
import userEvent from '@testing-library/user-event';
import { spy } from 'sinon';
import { createRenderer, isJSDOM, popupConformanceTests } from '#test-utils';

async function wait(time: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
}

describe('<Menu.Root />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  const { render } = createRenderer();

  popupConformanceTests({
    createComponent: (props) => (
      <Menu.Root {...props.root}>
        <Menu.Trigger {...props.trigger}>Open menu</Menu.Trigger>
        <Menu.Portal {...props.portal}>
          <Menu.Positioner>
            <Menu.Popup {...props.popup}>
              <Menu.Item>Item</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ),
    render,
    triggerMouseAction: 'click',
    expectedPopupRole: 'menu',
  });

  describe('keyboard navigation', () => {
    it('changes the highlighted item using the arrow keys', async () => {
      const { getByRole, getByTestId } = await render(
        <Menu.Root>
          <Menu.Trigger>Toggle</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item data-testid="item-1">1</Menu.Item>
                <Menu.Item data-testid="item-2">2</Menu.Item>
                <Menu.Item data-testid="item-3">3</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = getByRole('button', { name: 'Toggle' });
      await act(async () => {
        trigger.focus();
      });

      await userEvent.keyboard('[Enter]');

      const item1 = getByTestId('item-1');
      const item2 = getByTestId('item-2');
      const item3 = getByTestId('item-3');

      await waitFor(() => {
        expect(item1).toHaveFocus();
      });

      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(item2).toHaveFocus();
      });

      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(item3).toHaveFocus();
      });

      await userEvent.keyboard('{ArrowUp}');
      await waitFor(() => {
        expect(item2).toHaveFocus();
      });
    });

    it('changes the highlighted item using the Home and End keys', async () => {
      const { getByRole, getByTestId } = await render(
        <Menu.Root>
          <Menu.Trigger>Toggle</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item data-testid="item-1">1</Menu.Item>
                <Menu.Item data-testid="item-2">2</Menu.Item>
                <Menu.Item data-testid="item-3">3</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = getByRole('button', { name: 'Toggle' });
      await act(async () => {
        trigger.focus();
      });

      await userEvent.keyboard('[Enter]');
      const item1 = getByTestId('item-1');
      const item3 = getByTestId('item-3');

      await waitFor(() => {
        expect(item1).toHaveFocus();
      });

      await userEvent.keyboard('{End}');
      await waitFor(() => {
        expect(item3).toHaveFocus();
      });

      await userEvent.keyboard('{Home}');
      await waitFor(() => {
        expect(item1).toHaveFocus();
      });
    });

    it('includes disabled items during keyboard navigation', async () => {
      const { getByRole, getByTestId } = await render(
        <Menu.Root>
          <Menu.Trigger>Toggle</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item data-testid="item-1">1</Menu.Item>
                <Menu.Item disabled data-testid="item-2">
                  2
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = getByRole('button', { name: 'Toggle' });
      await act(async () => {
        trigger.focus();
      });

      await userEvent.keyboard('[Enter]');

      const item1 = getByTestId('item-1');
      const item2 = getByTestId('item-2');

      await waitFor(() => {
        expect(item1).toHaveFocus();
      });

      await userEvent.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(item2).toHaveFocus();
      });

      expect(item2).to.have.attribute('aria-disabled', 'true');
    });

    describe('text navigation', () => {
      it('changes the highlighted item', async ({ skip }) => {
        if (isJSDOM) {
          // useMenuPopup Text navigation match menu items using HTMLElement.innerText
          // innerText is not supported by JSDOM
          skip();
        }

        const { getByText, getAllByRole, user } = await render(
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Aa</Menu.Item>
                  <Menu.Item>Ba</Menu.Item>
                  <Menu.Item>Bb</Menu.Item>
                  <Menu.Item>Ca</Menu.Item>
                  <Menu.Item>Cb</Menu.Item>
                  <Menu.Item>Cd</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>,
        );

        const items = getAllByRole('menuitem');

        await act(async () => {
          items[0].focus();
        });

        await user.keyboard('c');
        await waitFor(() => {
          expect(getByText('Ca')).toHaveFocus();
        });

        expect(getByText('Ca')).to.have.attribute('tabindex', '0');

        await user.keyboard('d');
        await waitFor(() => {
          expect(getByText('Cd')).toHaveFocus();
        });

        expect(getByText('Cd')).to.have.attribute('tabindex', '0');
      });

      it('changes the highlighted item using text navigation on label prop', async ({ skip }) => {
        if (!isJSDOM) {
          // This test is very flaky in real browsers
          skip();
        }

        const { getByRole, getAllByRole, user } = await render(
          <Menu.Root>
            <Menu.Trigger>Toggle</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item label="Aa">1</Menu.Item>
                  <Menu.Item label="Ba">2</Menu.Item>
                  <Menu.Item label="Bb">3</Menu.Item>
                  <Menu.Item label="Ca">4</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>,
        );

        const trigger = getByRole('button', { name: 'Toggle' });
        await user.click(trigger);
        const items = getAllByRole('menuitem');
        await flushMicrotasks();

        await user.keyboard('b');
        await waitFor(() => {
          expect(items[1]).toHaveFocus();
        });

        await waitFor(() => {
          expect(items[1]).to.have.attribute('tabindex', '0');
        });

        await user.keyboard('b');
        await waitFor(() => {
          expect(items[2]).toHaveFocus();
        });

        await waitFor(() => {
          expect(items[2]).to.have.attribute('tabindex', '0');
        });

        await user.keyboard('b');
        await waitFor(() => {
          expect(items[2]).toHaveFocus();
        });

        await waitFor(() => {
          expect(items[2]).to.have.attribute('tabindex', '0');
        });
      });

      it('skips the non-stringifiable items', async ({ skip }) => {
        if (isJSDOM) {
          // useMenuPopup Text navigation match menu items using HTMLElement.innerText
          // innerText is not supported by JSDOM
          skip();
        }

        const { getByText, getAllByRole, user } = await render(
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Aa</Menu.Item>
                  <Menu.Item>Ba</Menu.Item>
                  <Menu.Item />
                  <Menu.Item>
                    <div>Nested Content</div>
                  </Menu.Item>
                  <Menu.Item>{undefined}</Menu.Item>
                  <Menu.Item>{null}</Menu.Item>
                  <Menu.Item>Bc</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>,
        );

        const items = getAllByRole('menuitem');

        await act(async () => {
          items[0].focus();
        });

        await user.keyboard('b');
        await waitFor(() => {
          expect(getByText('Ba')).toHaveFocus();
        });
        expect(getByText('Ba')).to.have.attribute('tabindex', '0');

        await user.keyboard('c');
        await waitFor(() => {
          expect(getByText('Bc')).toHaveFocus();
        });
        expect(getByText('Bc')).to.have.attribute('tabindex', '0');
      });

      it('navigate to options with diacritic characters', async ({ skip }) => {
        if (isJSDOM) {
          // useMenuPopup Text navigation match menu items using HTMLElement.innerText
          // innerText is not supported by JSDOM
          skip();
        }

        const { getByText, getAllByRole, user } = await render(
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Aa</Menu.Item>
                  <Menu.Item>Ba</Menu.Item>
                  <Menu.Item>Bb</Menu.Item>
                  <Menu.Item>Bą</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>,
        );

        const items = getAllByRole('menuitem');

        await act(async () => {
          items[0].focus();
        });

        await user.keyboard('b');
        await waitFor(() => {
          expect(getByText('Ba')).toHaveFocus();
        });
        expect(getByText('Ba')).to.have.attribute('tabindex', '0');

        await user.keyboard('ą');
        await waitFor(() => {
          expect(getByText('Bą')).toHaveFocus();
        });
        expect(getByText('Bą')).to.have.attribute('tabindex', '0');
      });

      it('navigate to next options beginning with diacritic characters', async ({ skip }) => {
        if (isJSDOM) {
          // useMenuPopup Text navigation match menu items using HTMLElement.innerText
          // innerText is not supported by JSDOM
          skip();
        }

        const { getByText, getAllByRole, user } = await render(
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Aa</Menu.Item>
                  <Menu.Item>ąa</Menu.Item>
                  <Menu.Item>ąb</Menu.Item>
                  <Menu.Item>ąc</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>,
        );

        const items = getAllByRole('menuitem');

        await act(async () => {
          items[0].focus();
        });

        await user.keyboard('ą');
        await waitFor(() => {
          expect(getByText('ąa')).toHaveFocus();
        });
        expect(getByText('ąa')).to.have.attribute('tabindex', '0');
      });

      it('does not trigger the onClick event when Space is pressed during text navigation', async ({
        skip,
      }) => {
        if (isJSDOM) {
          // useMenuPopup Text navigation match menu items using HTMLElement.innerText
          // innerText is not supported by JSDOM
          skip();
        }

        const handleClick = spy();

        const { getAllByRole, user } = await render(
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item onClick={() => handleClick()}>Item One</Menu.Item>
                  <Menu.Item onClick={() => handleClick()}>Item Two</Menu.Item>
                  <Menu.Item onClick={() => handleClick()}>Item Three</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>,
        );

        const items = getAllByRole('menuitem');

        await act(async () => {
          items[0].focus();
        });

        await user.keyboard('Item T');

        expect(handleClick.called).to.equal(false);

        await waitFor(() => {
          expect(items[1]).toHaveFocus();
        });
      });
    });
  });

  describe('nested menus', () => {
    (
      [
        ['vertical', 'ltr', 'ArrowRight', 'ArrowLeft'],
        ['vertical', 'rtl', 'ArrowLeft', 'ArrowRight'],
        ['horizontal', 'ltr', 'ArrowDown', 'ArrowUp'],
        ['horizontal', 'rtl', 'ArrowDown', 'ArrowUp'],
      ] as const
    ).forEach(([orientation, direction, openKey, closeKey]) => {
      it.skipIf(isJSDOM)(
        `opens a nested menu of a ${orientation} ${direction.toUpperCase()} menu with ${openKey} key and closes it with ${closeKey}`,
        async () => {
          const { user } = await render(
            <DirectionProvider direction={direction}>
              <Menu.Root open orientation={orientation}>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup>
                      <Menu.Item>1</Menu.Item>
                      <Menu.SubmenuRoot orientation={orientation}>
                        <Menu.SubmenuTrigger data-testid="submenu-trigger">2</Menu.SubmenuTrigger>
                        <Menu.Portal>
                          <Menu.Positioner>
                            <Menu.Popup data-testid="submenu">
                              <Menu.Item data-testid="submenu-item-1">2.1</Menu.Item>
                              <Menu.Item>2.2</Menu.Item>
                            </Menu.Popup>
                          </Menu.Positioner>
                        </Menu.Portal>
                      </Menu.SubmenuRoot>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            </DirectionProvider>,
          );

          const submenuTrigger = screen.getByTestId('submenu-trigger');

          await act(async () => {
            submenuTrigger.focus();
          });

          // This check fails in JSDOM
          await waitFor(() => {
            expect(submenuTrigger).toHaveFocus();
          });

          await user.keyboard(`[${openKey}]`);

          let submenu: HTMLElement | null = await screen.findByTestId('submenu');

          const submenuItem1 = screen.queryByTestId('submenu-item-1');
          expect(submenuItem1).not.to.equal(null);
          await waitFor(() => {
            expect(submenuItem1).toHaveFocus();
          });

          await user.keyboard(`[${closeKey}]`);

          submenu = screen.queryByTestId('submenu');
          expect(submenu).to.equal(null);

          expect(submenuTrigger).toHaveFocus();
        },
      );
    });

    it('opens submenu on click when openOnHover is false', async () => {
      const { getByRole, queryByTestId, findByTestId, user } = await render(
        <Menu.Root>
          <Menu.Trigger>Open Main</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner data-testid="menu">
              <Menu.Popup>
                <Menu.Item>Item 1</Menu.Item>
                <Menu.SubmenuRoot openOnHover={false}>
                  <Menu.SubmenuTrigger data-testid="submenu-trigger">Submenu</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner data-testid="submenu">
                      <Menu.Popup>
                        <Menu.Item data-testid="submenu-item">Submenu Item</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const mainTrigger = getByRole('button', { name: 'Open Main' });
      await user.click(mainTrigger);

      const submenu = await findByTestId('menu');
      expect(queryByTestId('submenu')).to.equal(null);

      const submenuTrigger = await findByTestId('submenu-trigger');
      await user.click(submenuTrigger);

      expect(submenu).not.to.equal(null);
      expect(await findByTestId('submenu-item')).to.have.text('Submenu Item');
    });

    it('closes submenus when focus is lost by shift-tabbing from a nested menu', async () => {
      const { getByRole, queryByTestId, findByTestId, user } = await render(
        <Menu.Root>
          <Menu.Trigger>Open Main</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner data-testid="menu">
              <Menu.Popup>
                <Menu.Item>Item 1</Menu.Item>
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger data-testid="submenu-trigger">Submenu</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner data-testid="submenu">
                      <Menu.Popup>
                        <Menu.Item data-testid="submenu-item">Submenu Item</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const mainTrigger = getByRole('button', { name: 'Open Main' });
      await user.click(mainTrigger);

      await findByTestId('menu');
      expect(queryByTestId('submenu')).to.equal(null);

      const submenuTrigger = await findByTestId('submenu-trigger');
      await user.hover(submenuTrigger);

      await waitFor(() => {
        expect(queryByTestId('submenu')).not.to.equal(null);
      });

      const submenuItem = await findByTestId('submenu-item');
      await act(async () => {
        submenuItem.focus();
      });

      await waitFor(() => {
        expect(submenuItem).toHaveFocus();
      });

      // Shift+Tab should close the submenu and focus should return to the submenu trigger
      await user.keyboard('{Shift>}{Tab}{/Shift}');

      await waitFor(() => {
        expect(queryByTestId('submenu')).to.equal(null);
      });

      expect(submenuTrigger).toHaveFocus();
    });
  });

  describe('focus management', () => {
    function Test() {
      return (
        <Menu.Root>
          <Menu.Trigger>Toggle</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>1</Menu.Item>
                <Menu.Item>2</Menu.Item>
                <Menu.Item>3</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      );
    }

    it('focuses the first item after the menu is opened by keyboard', async () => {
      const { getAllByRole, getByRole } = await render(<Test />);

      const trigger = getByRole('button', { name: 'Toggle' });
      await act(async () => {
        trigger.focus();
      });

      await userEvent.keyboard('[Enter]');

      const [firstItem, ...otherItems] = getAllByRole('menuitem');
      await waitFor(() => {
        expect(firstItem.tabIndex).to.equal(0);
      });
      otherItems.forEach((item) => {
        expect(item.tabIndex).to.equal(-1);
      });
    });

    it('focuses the first item when down arrow key opens the menu', async () => {
      const { getByRole, getAllByRole, user } = await render(<Test />);

      const trigger = getByRole('button', { name: 'Toggle' });
      await act(async () => {
        trigger.focus();
      });

      await user.keyboard('[ArrowDown]');

      const [firstItem, ...otherItems] = getAllByRole('menuitem');
      await waitFor(() => expect(firstItem).toHaveFocus());
      expect(firstItem.tabIndex).to.equal(0);
      otherItems.forEach((item) => {
        expect(item.tabIndex).to.equal(-1);
      });
    });

    it('focuses the last item when up arrow key opens the menu', async () => {
      const { getByRole, getAllByRole, user } = await render(<Test />);

      const trigger = getByRole('button', { name: 'Toggle' });

      await act(async () => {
        trigger.focus();
      });

      await user.keyboard('[ArrowUp]');

      const [firstItem, secondItem, lastItem] = getAllByRole('menuitem');
      await waitFor(() => {
        expect(lastItem).toHaveFocus();
      });

      expect(lastItem.tabIndex).to.equal(0);
      [firstItem, secondItem].forEach((item) => {
        expect(item.tabIndex).to.equal(-1);
      });
    });

    it('focuses the trigger after the menu is closed', async () => {
      const { getByRole, findByRole, user } = await render(
        <div>
          <input type="text" />
          <Menu.Root>
            <Menu.Trigger>Toggle</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Close</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <input type="text" />
        </div>,
      );

      const button = getByRole('button', { name: 'Toggle' });
      await user.click(button);

      const menuItem = await findByRole('menuitem');
      await user.click(menuItem);

      expect(button).toHaveFocus();
    });

    it('focuses the trigger after the menu is closed but not unmounted', async ({ skip }) => {
      if (isJSDOM) {
        // TODO: this stopped working in vitest JSDOM mode
        skip();
      }

      const { getByRole, findByRole, user } = await render(
        <div>
          <input type="text" />
          <Menu.Root>
            <Menu.Trigger>Toggle</Menu.Trigger>
            <Menu.Portal keepMounted>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Close</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <input type="text" />
        </div>,
      );

      const button = getByRole('button', { name: 'Toggle' });
      await user.click(button);

      const menuItem = await findByRole('menuitem');
      await user.click(menuItem);

      await waitFor(() => {
        expect(button).toHaveFocus();
      });
    });
  });

  describe('prop: closeParentOnEsc', () => {
    it('closes the parent menu when the Escape key is pressed by default', async () => {
      const { getByRole, queryByRole, user } = await render(
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>1</Menu.Item>
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger>2</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup>
                        <Menu.Item>2.1</Menu.Item>
                        <Menu.Item>2.2</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = getByRole('button', { name: 'Open' });
      await act(async () => {
        trigger.focus();
      });

      await user.keyboard('[ArrowDown]');
      await waitFor(() => {
        expect(getByRole('menuitem', { name: '1' })).toHaveFocus();
      });

      await user.keyboard('[ArrowDown]');
      await waitFor(() => {
        expect(getByRole('menuitem', { name: '2' })).toHaveFocus();
      });

      await user.keyboard('[ArrowRight]');
      await waitFor(() => {
        expect(getByRole('menuitem', { name: '2.1' })).toHaveFocus();
      });

      await user.keyboard('[Escape]');
      await flushMicrotasks();

      expect(queryByRole('menu', { hidden: false })).to.equal(null);
    });

    it('does not close the parent menu when the Escape key is pressed if `closeParentOnEsc=false`', async () => {
      const { getByRole, queryAllByRole, user } = await render(
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup id="parent-menu">
                <Menu.Item>1</Menu.Item>
                <Menu.SubmenuRoot closeParentOnEsc={false}>
                  <Menu.SubmenuTrigger>2</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup id="submenu">
                        <Menu.Item>2.1</Menu.Item>
                        <Menu.Item>2.2</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = getByRole('button', { name: 'Open' });
      await act(async () => {
        trigger.focus();
      });

      await user.keyboard('[ArrowDown]');
      await waitFor(() => {
        expect(getByRole('menuitem', { name: '1' })).toHaveFocus();
      });

      await user.keyboard('[ArrowDown]');
      await waitFor(() => {
        expect(getByRole('menuitem', { name: '2' })).toHaveFocus();
      });

      await user.keyboard('[ArrowRight]');
      await waitFor(() => {
        expect(getByRole('menuitem', { name: '2.1' })).toHaveFocus();
      });

      await user.keyboard('[Escape]');

      const menus = queryAllByRole('menu', { hidden: false });
      await waitFor(() => {
        expect(menus.length).to.equal(1);
      });

      expect(menus[0].id).to.equal('parent-menu');
    });
  });

  describe('prop: modal', () => {
    it('should render an internal backdrop when `true`', async () => {
      const { user } = await render(
        <div>
          <Menu.Root modal>
            <Menu.Trigger>Open</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner data-testid="positioner">
                <Menu.Popup>
                  <Menu.Item>1</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <button>Outside</button>
        </div>,
      );

      const trigger = screen.getByRole('button', { name: 'Open' });

      await user.click(trigger);

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.to.equal(null);
      });

      const positioner = screen.getByTestId('positioner');

      // eslint-disable-next-line testing-library/no-node-access
      expect(positioner.previousElementSibling).to.have.attribute('role', 'presentation');
    });

    it('should not render an internal backdrop when `false`', async () => {
      const { user } = await render(
        <div>
          <Menu.Root modal={false}>
            <Menu.Trigger>Open</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner data-testid="positioner">
                <Menu.Popup>
                  <Menu.Item>1</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <button>Outside</button>
        </div>,
      );

      const trigger = screen.getByRole('button', { name: 'Open' });

      await user.click(trigger);

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.to.equal(null);
      });

      const positioner = screen.getByTestId('positioner');

      // eslint-disable-next-line testing-library/no-node-access
      expect(positioner.previousElementSibling).to.equal(null);
    });
  });

  describe('prop: actionsRef', () => {
    it('unmounts the menu when the `unmount` method is called', async () => {
      const actionsRef = {
        current: {
          unmount: spy(),
        },
      };

      const { user } = await render(
        <Menu.Root actionsRef={actionsRef}>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Open' });
      await act(() => {
        trigger.focus();
      });

      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.to.equal(null);
      });

      await user.click(trigger);

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.to.equal(null);
      });

      await act(async () => {
        await new Promise((resolve) => {
          requestAnimationFrame(resolve);
        });

        actionsRef.current.unmount();
      });

      await waitFor(() => {
        expect(screen.queryByRole('menu')).to.equal(null);
      });
    });
  });

  describe.skipIf(isJSDOM)('prop: onOpenChangeComplete', () => {
    it('is called on close when there is no exit animation defined', async () => {
      const onOpenChangeComplete = spy();

      function Test() {
        const [open, setOpen] = React.useState(true);
        return (
          <div>
            <button onClick={() => setOpen(false)}>Close</button>
            <Menu.Root open={open} onOpenChangeComplete={onOpenChangeComplete}>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup data-testid="popup" />
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </div>
        );
      }

      const { user } = await render(<Test />);

      const closeButton = screen.getByText('Close');
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByTestId('popup')).to.equal(null);
      });

      expect(onOpenChangeComplete.firstCall.args[0]).to.equal(true);
      expect(onOpenChangeComplete.lastCall.args[0]).to.equal(false);
    });

    it('is called on close when the exit animation finishes', async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      const onOpenChangeComplete = spy();

      function Test() {
        const style = `
          @keyframes test-anim {
            to {
              opacity: 0;
            }
          }

          .animation-test-indicator[data-ending-style] {
            animation: test-anim 1ms;
          }
        `;

        const [open, setOpen] = React.useState(true);

        return (
          <div>
            {/* eslint-disable-next-line react/no-danger */}
            <style dangerouslySetInnerHTML={{ __html: style }} />
            <button onClick={() => setOpen(false)}>Close</button>
            <Menu.Root open={open} onOpenChangeComplete={onOpenChangeComplete}>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup className="animation-test-indicator" data-testid="popup" />
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </div>
        );
      }

      const { user } = await render(<Test />);

      expect(screen.getByTestId('popup')).not.to.equal(null);

      // Wait for open animation to finish
      await waitFor(() => {
        expect(onOpenChangeComplete.firstCall.args[0]).to.equal(true);
      });

      const closeButton = screen.getByText('Close');
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByTestId('popup')).to.equal(null);
      });

      expect(onOpenChangeComplete.lastCall.args[0]).to.equal(false);
    });

    it('is called on open when there is no enter animation defined', async () => {
      const onOpenChangeComplete = spy();

      function Test() {
        const [open, setOpen] = React.useState(false);
        return (
          <div>
            <button onClick={() => setOpen(true)}>Open</button>
            <Menu.Root open={open} onOpenChangeComplete={onOpenChangeComplete}>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup data-testid="popup" />
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </div>
        );
      }

      const { user } = await render(<Test />);

      const openButton = screen.getByText('Open');
      await user.click(openButton);

      await waitFor(() => {
        expect(screen.queryByTestId('popup')).not.to.equal(null);
      });

      expect(onOpenChangeComplete.callCount).to.equal(2);
      expect(onOpenChangeComplete.firstCall.args[0]).to.equal(true);
    });

    it('is called on open when the enter animation finishes', async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      const onOpenChangeComplete = spy();

      function Test() {
        const style = `
          @keyframes test-anim {
            from {
              opacity: 0;
            }
          }

          .animation-test-indicator[data-starting-style] {
            animation: test-anim 1ms;
          }
        `;

        const [open, setOpen] = React.useState(false);

        return (
          <div>
            {/* eslint-disable-next-line react/no-danger */}
            <style dangerouslySetInnerHTML={{ __html: style }} />
            <button onClick={() => setOpen(true)}>Open</button>
            <Menu.Root
              open={open}
              onOpenChange={setOpen}
              onOpenChangeComplete={onOpenChangeComplete}
            >
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup className="animation-test-indicator" data-testid="popup" />
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </div>
        );
      }

      const { user } = await render(<Test />);

      const openButton = screen.getByText('Open');
      await user.click(openButton);

      // Wait for open animation to finish
      await waitFor(() => {
        expect(onOpenChangeComplete.firstCall.args[0]).to.equal(true);
      });

      expect(screen.queryByTestId('popup')).not.to.equal(null);
    });

    it('does not get called on mount when not open', async () => {
      const onOpenChangeComplete = spy();

      await render(
        <Menu.Root onOpenChangeComplete={onOpenChangeComplete}>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      expect(onOpenChangeComplete.callCount).to.equal(0);
    });
  });

  describe('prop: openOnHover', () => {
    it('should open the menu when the trigger is hovered', async () => {
      const { getByRole, queryByRole } = await render(
        <Menu.Root openOnHover delay={0}>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>1</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = getByRole('button', { name: 'Open' });

      await act(async () => {
        trigger.focus();
      });

      await userEvent.hover(trigger);

      await waitFor(() => {
        expect(queryByRole('menu')).not.to.equal(null);
      });
    });

    it.skipIf(!isJSDOM)('should close the menu when the trigger is no longer hovered', async () => {
      const { getByRole, queryByRole } = await render(
        <Menu.Root openOnHover delay={0} modal={false}>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>1</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = getByRole('button', { name: 'Open' });

      await act(async () => {
        trigger.focus();
      });

      await userEvent.hover(trigger);

      await waitFor(() => {
        expect(queryByRole('menu')).not.to.equal(null);
      });

      await userEvent.unhover(trigger);

      await waitFor(() => {
        expect(queryByRole('menu')).to.equal(null);
      });
    });

    it('should not close when submenu is hovered after root menu is hovered', async () => {
      const { getByRole, getByTestId } = await render(
        <Menu.Root openOnHover delay={0}>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner data-testid="menu">
              <Menu.Popup>
                <Menu.Item>1</Menu.Item>
                <Menu.SubmenuRoot delay={0}>
                  <Menu.SubmenuTrigger>2</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner data-testid="submenu">
                      <Menu.Popup>
                        <Menu.Item>2.1</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = getByRole('button', { name: 'Open' });

      await act(async () => {
        trigger.focus();
      });

      await userEvent.hover(trigger);

      await waitFor(() => {
        expect(getByTestId('menu')).not.to.equal(null);
      });

      const menu = getByTestId('menu');

      await userEvent.hover(menu);

      const submenuTrigger = getByRole('menuitem', { name: '2' });

      await userEvent.hover(submenuTrigger);

      await waitFor(() => {
        expect(getByTestId('menu')).not.to.equal(null);
      });
      await waitFor(() => {
        expect(getByTestId('submenu')).not.to.equal(null);
      });

      const submenu = getByTestId('submenu');

      await userEvent.unhover(menu);
      await userEvent.hover(submenu);

      await waitFor(() => {
        expect(getByTestId('menu')).not.to.equal(null);
      });
      await waitFor(() => {
        expect(getByTestId('submenu')).not.to.equal(null);
      });
    });
  });

  describe('prop: closeDelay', () => {
    const { render: renderFakeTimers, clock } = createRenderer();

    clock.withFakeTimers();

    it('should close after delay', async () => {
      await renderFakeTimers(
        <Menu.Root openOnHover delay={0} closeDelay={100}>
          <Menu.Trigger />
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>Content</Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const anchor = screen.getByRole('button');

      fireEvent.mouseEnter(anchor);
      fireEvent.mouseMove(anchor);

      await flushMicrotasks();

      expect(screen.getByText('Content')).not.to.equal(null);

      fireEvent.mouseLeave(anchor);

      clock.tick(50);

      expect(screen.getByText('Content')).not.to.equal(null);

      clock.tick(50);

      expect(screen.queryByText('Content')).to.equal(null);
    });
  });

  describe('dynamic items', () => {
    const { render: renderFakeTimers, clock } = createRenderer({
      clockOptions: {
        shouldAdvanceTime: true,
      },
    });

    clock.withFakeTimers();

    it('skips null items when navigating', async () => {
      function DynamicMenu() {
        const [itemsFiltered, setItemsFiltered] = React.useState(false);

        return (
          <Menu.Root
            onOpenChange={(newOpen) => {
              if (newOpen) {
                setTimeout(() => {
                  setItemsFiltered(true);
                }, 0);
              }
            }}
            onOpenChangeComplete={(newOpen) => {
              if (!newOpen) {
                setItemsFiltered(false);
              }
            }}
          >
            <Menu.Trigger>Toggle</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Add to Library</Menu.Item>
                  {!itemsFiltered && (
                    <React.Fragment>
                      <Menu.Item>Add to Playlist</Menu.Item>
                      <Menu.Item>Play Next</Menu.Item>
                      <Menu.Item>Play Last</Menu.Item>
                    </React.Fragment>
                  )}
                  <Menu.Item>Favorite</Menu.Item>
                  <Menu.Item>Share</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        );
      }

      const { user } = await renderFakeTimers(<DynamicMenu />);

      const trigger = screen.getByText('Toggle');

      await act(async () => {
        trigger.focus();
      });

      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.to.equal(null);
      });

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}'); // Share
      await user.keyboard('{ArrowDown}'); // loops back to Add to Library

      expect(screen.queryByRole('menuitem', { name: 'Add to Library' })).toHaveFocus();
    });
  });

  describe.skipIf(isJSDOM)('mouse interaction', () => {
    afterEach(async () => {
      const { cleanup } = await import('vitest-browser-react');
      cleanup();
    });

    it('triggers a menu item and closes the menu on click, drag, release', async () => {
      const openChangeSpy = spy();
      const clickSpy = spy();

      await render(
        <div>
          <Menu.Root onOpenChange={openChangeSpy}>
            <Menu.Trigger>Toggle</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup data-testid="menu">
                  <Menu.Item data-testid="item-1">1</Menu.Item>
                  <Menu.Item data-testid="item-2" onClick={clickSpy}>
                    2
                  </Menu.Item>
                  <Menu.Item data-testid="item-3">3</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>,
      );

      const trigger = screen.getByRole('button', { name: 'Toggle' });

      fireEvent.mouseDown(trigger);

      await waitFor(() => {
        expect(screen.queryByTestId('menu')).not.to.equal(null);
      });

      await wait(200);

      const item2 = screen.getByTestId('item-2');
      fireEvent.mouseUp(item2);

      await waitFor(() => {
        expect(screen.queryByTestId('menu')).to.equal(null);
      });

      expect(clickSpy.callCount).to.equal(1);

      expect(openChangeSpy.callCount).to.equal(2);
      expect(openChangeSpy.firstCall.args[0]).to.equal(true);
      expect(openChangeSpy.lastCall.args[0]).to.equal(false);
      expect(openChangeSpy.lastCall.args[2]).to.equal('item-press');
    });

    it('closes the menu on click, drag outside, release', async () => {
      const { userEvent: user } = await import('@vitest/browser/context');
      const { render: vbrRender } = await import('vitest-browser-react');

      const openChangeSpy = spy();

      vbrRender(
        <div>
          <Menu.Root onOpenChange={openChangeSpy}>
            <Menu.Trigger>Toggle</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup data-testid="menu">
                  <Menu.Item>1</Menu.Item>
                  <Menu.Item>2</Menu.Item>
                  <Menu.Item>3</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <div data-testid="outside">Outside</div>
        </div>,
      );

      const trigger = screen.getByRole('button', { name: 'Toggle' });
      const outsideElement = screen.getByTestId('outside');

      await user.dragAndDrop(trigger, outsideElement);

      await waitFor(() => {
        expect(screen.queryByTestId('menu')).to.equal(null);
      });

      expect(openChangeSpy.callCount).to.equal(2);
      expect(openChangeSpy.firstCall.args[0]).to.equal(true);
      expect(openChangeSpy.lastCall.args[0]).to.equal(false);
      expect(openChangeSpy.lastCall.args[2]).to.equal('cancel-open');
    });
  });
});
