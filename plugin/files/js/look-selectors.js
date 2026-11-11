/* APEX Visual Designer — Universal Theme selectors used by Page Look output.
   One map per APEX version, so an upgrade changes this file only.
   All selectors are relative to the region's Static ID. */
(function () {
  window.VD = window.VD || {};
  window.VD.lookSelectors = {
    '26.2': {
      // Layout wrappers inside a stage region body, flattened with display:contents.
      regionBody: '.t-Region-body',
      wrappers: ['> .container', '> .container > .row', '> .container > .row > .col'],
      regionHeader: '.t-Region-header',
      itemContainerSuffix: '_CONTAINER',
      // Page item internals, relative to #ITEM_CONTAINER (used by Flutter variants).
      field: {
        wrap: '.t-Form-inputContainer',
        label: '.t-Form-label',
        floatingLabel: '.t-Form-fieldContainer--floatingLabel .t-Form-label',
        input: 'input.text_field, input.apex-item-text, input.number_field, input.password, textarea, select, .apex-item-datepicker input, .a-DatePicker input',
        icon: '.apex-item-icon, .a-Button--calendar, .a-Button--popupLOV',
        error: '.t-Form-error',
        help: '.t-Form-helpText',
        option: '.apex-item-option',
        optionInput: '.apex-item-option input',
        optionLabel: '.apex-item-option label',
        switchTrack: '.a-Switch-toggle',
        switchInput: '.a-Switch input',
        display: '.display_only'
      },
      button: '.t-Button',
      region: { frame: '.t-Region', header: '.t-Region-header', title: '.t-Region-title', body: '.t-Region-body' },
      cards: { card: '.a-CardView', media: '.a-CardView-media', title: '.a-CardView-title', body: '.a-CardView-body' },
      ig: {
        toolbar: '.a-IG-header',
        header: '.a-GV-header',
        row: '.a-GV-row',
        rowAlt: '.a-GV-row:nth-child(even)',
        rowHover: '.a-GV-row:hover'
      },
      ir: {
        toolbar: '.a-IRR-toolbar',
        header: '.a-IRR-header',
        row: '.a-IRR-table tr',
        rowAlt: '.a-IRR-table tr:nth-child(even)',
        rowHover: '.a-IRR-table tr:hover'
      },
      // Show / hide switches: what each switch hides, relative to the component.
      hide: {
        ir: { hideSearch: '.a-IRR-search', hideActions: '.a-IRR-actions', hideRowsPerPage: '.a-IRR-rowSelector',
          hideReset: '.a-IRR-button--reset', hideColumnMenu: '.a-IRR-headerLink', hidePagination: '.a-IRR-paginationWrap',
          hideSettingsBar: '.a-IRR-controlsContainer' },
        ig: { hideToolbar: '.a-IG-header', hideSearch: '.a-Toolbar-group--search, .a-IG-searchField',
          hideActions: '.a-IG-actionsMenu, [data-action="actions"]', hideEditSave: '[data-action="edit"], [data-action="save"]',
          hideFooter: '.a-IG-footer' },
        classic: { hidePagination: '.t-Report-pagination', hideNoData: '.nodatafound', hideHeadings: '.t-Report-report thead' },
        cards: { hidePagination: '.a-CardView-pagination, .t-Report-pagination', hideNoData: '.a-CardView-noData, .nodatafound' },
        region: { hideTitle: '.t-Region-header', hideRegionButtons: '.t-Region-headerItems--buttons, .t-Region-buttons' },
        item: { hideLabel: '.t-Form-labelContainer', hideHelp: '.t-Form-helpButton, .t-Form-itemAssistance',
          hideRequired: '.t-Form-required' },
        button: { hideIcon: '.t-Icon', hideLabel: '.t-Button-label' }
      },
      classic: {
        toolbar: '.t-Report-links',
        header: '.t-Report-report th',
        row: '.t-Report-report tr',
        rowAlt: '.t-Report-report tr:nth-child(even)',
        rowHover: '.t-Report-report tr:hover'
      }
    }
  };
})();
