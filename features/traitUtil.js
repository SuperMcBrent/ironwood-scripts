(events, elementWatcher, configuration, components, localDatabase) => {

    const STORE_NAME = 'various';
    const KEY_SORTTYPE = 'trait-util-sort-type'

    let enabled = false;
    let sortType = 'None';
    let traitNameFilter = '';
    let submenuObserver = null;
    let cardMutationObserver = null;

    async function initialise() {
        configuration.registerCheckbox({
            category: 'UI Features',
            key: 'trait-util-enabled',
            name: 'Trait Utilities',
            default: enabled,
            handler: handleConfigStateChange
        });
        events.register('page', handlePage);
        const savedState = await localDatabase.getAllEntries(STORE_NAME);
        sortType = savedState?.find(s => s.key === KEY_SORTTYPE)?.value || sortType;
    }

    function handleConfigStateChange(state) {
        enabled = state;
    }

    async function handlePage() {
        if (!enabled) return;
        const last = events.getLast('page');
        if (!last || last.type !== 'traits') {

            if (cardMutationObserver) {
                cardMutationObserver.disconnect();
                cardMutationObserver = null;
            }
            if (submenuObserver) {
                submenuObserver.disconnect();
                submenuObserver = null;
            }

            return;
        };

        components.removeComponent(componentBlueprint);

        const sortDropdown = components.search(componentBlueprint, 'sortDropdown');
        sortDropdown.default = sortType;
        sortDropdown.options = ['None', 'Lv. ASC', 'Lv. DESC'].map(option => ({
            text: option,
            value: option,
            selected: option === sortType
        }));

        await elementWatcher.exists('traits-page .header > .name:contains("Equipped")');

        components.addComponent(componentBlueprint);

        observeCardChanges();
        observeSubmenuClicks();
        applySort();
        applyNameFilter();
    }

    function applySort() {
        if (sortType === 'None') return;

        if (cardMutationObserver) cardMutationObserver.disconnect();

        $('.card').each(function () {
            const $card = $(this);
            const $buttons = $card.find('button.row');

            const sorted = $buttons.toArray().sort((a, b) => {
                const levelA = parseInt($(a).find('.level').text().replace('Lv. ', '')) || 0;
                const levelB = parseInt($(b).find('.level').text().replace('Lv. ', '')) || 0;

                if (sortType === 'Lv. ASC') return levelA - levelB;
                if (sortType === 'Lv. DESC') return levelB - levelA;
                return 0;
            });

            $buttons.detach();
            $card.append(sorted);
        });

        observeCardChanges();
    }

    function applyNameFilter() {
        if (cardMutationObserver) cardMutationObserver.disconnect();

        $('.card').each(function () {
            const $buttons = $(this).find('button.row');

            $buttons.each(function () {
                const $btn = $(this);
                const traitName = $btn.find('.name').text().toLowerCase();
                const filter = traitNameFilter.trim().toLowerCase();

                if (!filter) {
                    $btn.show();
                    return;
                }

                if (traitName.includes(filter)) {
                    $btn.show();
                } else {
                    $btn.hide();
                }
            });
        });

        observeCardChanges();
    }

    function observeCardChanges() {
        if (cardMutationObserver) cardMutationObserver.disconnect();

        const container = document.querySelector('traits-page > .groups > .last');
        if (!container) return;

        cardMutationObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.addedNodes.length || mutation.removedNodes.length) {
                    applySort();
                    break;
                }
            }
        });

        cardMutationObserver.observe(container, {
            childList: true,
            subtree: true
        });
    }

    function observeSubmenuClicks() {
        if (submenuObserver) submenuObserver.disconnect();

        submenuObserver = new MutationObserver(() => {
            const traitsBtn = $('div.card:has(.header .name:contains("Menu")) button.row:contains("Traits")');
            traitsBtn.off('click.traitSorter').on('click.traitSorter', handlePage);
        });

        submenuObserver.observe(document.body, { childList: true, subtree: true });
    }

    const componentBlueprint = {
        componentId: 'trait-util-component',
        dependsOn: 'traits-page',
        parent: 'traits-page > .groups > .last',
        prepend: true,
        selectedTabIndex: 0,
        class: 'noMarginTop',
        tabs: [{
            title: 'Trait Utilities',
            rows: [{
                type: 'header',
                title: 'Trait Utilities',
            }, {
                id: 'filterName_input',
                type: 'input',
                name: 'Trait Name',
                value: '',
                clearable: true,
                inputType: 'text',
                text: 'Filter by name',
                layout: '1/2',
                action: value => {
                    traitNameFilter = value;
                    handlePage();
                },
            }, {
                id: 'sortDropdown',
                type: 'dropdown',
                name: 'Trait Sorting',
                compact: true,
                default: '',
                options: [],
                text: 'Sort Traits',
                layout: '1/2',
                action: value => {
                    sortType = value;
                    localDatabase.saveEntry(STORE_NAME, { key: KEY_SORTTYPE, value: sortType });
                    handlePage();
                }
            }]
        }]
    };

    initialise();
}
