import { Feature } from 'toolkit/extension/features/feature';
import { controllerLookup } from 'toolkit/extension/utils/ember';
import { l10n } from 'toolkit/extension/utils/toolkit';

export class ClearSelection extends Feature {
  uncheckTransactions = () => {
    let accountsController = controllerLookup('accounts');

    try {
      accountsController.set('areAllTransactionsSet', false);
      accountsController.get('areChecked').setEach('isChecked', 0);
      accountsController.send('closeModal');
    } catch (exception) {
      accountsController.send('closeModal');
      this.logFeatureError(exception);
    }
  };

  invoke() {
    this.onElement('.modal-account-edit-transaction-list', this.insertClearSelection, {
      guard: '#tk-clear-selection',
    });
  }

  observe() {
    this.onElement('.modal-account-edit-transaction-list', this.insertClearSelection, {
      guard: '#tk-clear-selection',
    });
  }

  destroy() {
    $('#tk-clear-selection, #tk-clear-selection + li').remove();
  }

  insertClearSelection = () => {
    const menuText = l10n('toolkit.accountsClearSelection', 'Clear Selection');

    // Note that ${menuText} was intentionally placed on the same line as the <i> tag to
    // prevent the leading space that occurs as a result of using a multi-line string.
    // Using a dedent function would allow it to be placed on its own line which would be
    // more natural.
    //
    // The second <li> functions as a separator on the menu after the feature menu item.
    $('.modal-account-edit-transaction-list .modal-list').prepend(
      $(`<li id="tk-clear-selection">
          <button class="button-list ynab-toolkit-clear-selection">
            <i class="ynab-new-icon flaticon stroke minus-2"></i>${menuText}
          </button>
        </li>
        <li><hr /><li>
      `).on('click', () => {
        this.uncheckTransactions();
      })
    );
  };
}
