(events, configuration, components, modal, elementCreator, util, skillCache, colorMapper, itemCache) => {

    let enabled = true;

    async function initialise() {
        elementCreator.addStyles(styles);
        events.register('page', handlePage);
    }

    function refresh() {
        handlePage(events.getLast('page'));
    }

    async function handlePage(last) {
        if (!enabled) {
            return;
        }
        if (!last || last.type !== 'inventory') {
            return;
        }


        $('inventory-page > .groups').hide();

        setUpInventory()

    }

    function setUpInventory() {
        const customInventory = $('<div>').addClass('customInventory');

        customInventory.append(createMenu());

        $('inventory-page').prepend(customInventory);

        const inventoryList = components.search(inventoryComponentBlueprint, 'inventoryList');
        inventoryList.entries = readInventory();


        components.addComponent(inventoryComponentBlueprint);
    }

    function createMenu() {
        let menuItems = [
            { img: '/assets/misc/inventory.png', name: 'All' },
        ];

        menuItems.push(...skillCache.list.filter(s => s.id > 0 && s.id < 16).map(s => ({ name: s.displayName, img: `/assets/${s.image}` })))

        const $menu = $('<div>').addClass('menu');

        menuItems.forEach(item => {
            const btn = $('<button>')
                .addClass('menu-btn');

            const img = $('<img>')
                .attr({ src: item.img, alt: item.name })
                .attr('title', item.name || '')
                .addClass('menu-btn-img');

            const span = $('<span>')
                .addClass('menu-btn-text').text(item.name);

            btn.append(img);
            $menu.append(btn);
        });

        return $menu;
    }

    function readInventory() {
        const items = [];

        $('inventory-page .groups .group .card .items .item').each(function () {
            const $el = $(this);

            const imgSrc = $el.find('img').attr('src') || '';
            const amount = $el.find('.amount').text().trim() || '1';

            const item = itemCache.list.find(i => `/assets/${i.image}` === imgSrc);
            console.log();

            items.push({
                name: item.name,
                image: imgSrc,
                amount: util.parseNumber(amount)
            });
        });

        return items
    }

    const inventoryComponentBlueprint = {
        componentId: 'custom-inventory-component',
        dependsOn: 'inventory-page .customInventory',
        parent: '.customInventory',
        selectedTabIndex: 0,
        tabs: [{
            title: 'tab',
            rows: [{
                type: 'header',
                title: 'Inventory',
                textRight: '69/100'
            }, {
                id: 'inventoryList',
                type: 'listView',
                maxHeight: 800,
                render: ($element, item) => {

                    $element.append(
                        $('<div/>').addClass('listRow').append(
                            $('<div/>').addClass('listCell imageCell').append(
                                $('<img/>')
                                    .attr('src', item.image || '/assets/misc/inventory.png')
                                    .attr('alt', item.name || '')
                                    .addClass('itemIcon')
                            ),
                            $('<div/>').addClass('listCell nameCell').text(item.name || 'Unknown'),
                            $('<div/>').addClass('listCell statCell').text(item.amount ?? '—'),
                            $('<div/>').addClass('listCell statCell').text(item.statB ?? '—'),
                            $('<div/>').addClass('listCell statCell').text(item.statC ?? '—')
                        )
                    );

                    return $element;
                },
                entries: [{ name: 'test1' }, { name: 'test2' }]
            }]
        }]
    };

    const styles = `

        .customInventory {
            width: 100%;
            background-color: ${colorMapper('componentRegular')}99;
            backdrop-filter: blur(15px);
            -webkit-backdrop-filter: blur(15px);
            display: flex;
            flex-direction: column;
            border-radius: 15px;
            padding: var(--gap)
        }

        .menu {
            width: 100%;
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: var(--gap);
            box-sizing: border-box;
        }

        .menu-btn {
            background-color: ${colorMapper('componentRegular')};
            border: 1px solid ${colorMapper('componentDark')};
            border-radius: 12px;
            font-family: Arial, sans-serif;
            cursor: pointer;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 50px;
            height: 50px;
            padding: calc(var(--gap) / 2);
            transition: background-color 0.3s ease;
            box-sizing: border-box;
        }

        .menu-btn:hover {
            background-color: ${colorMapper('componentHover')};
        }

        .menu-btn.selected {
            background-color: ${colorMapper('componentSelected')};
        }

        .menu-btn-img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            /*margin-bottom: 8px;*/
        }

        .menu-btn-text {
            font-size: 14px;
            text-align: center;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            width: 100%;
        }

        /* ------------- */

        .listRow {
            display: flex;
            width: 100%;
            box-sizing: border-box;
            align-items: center;
        }

        .listCell {
            padding: 0 calc(var(--gap) / 2);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .imageCell {
            width: 40px;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .itemIcon {
            width: 32px;
            height: 32px;
            object-fit: contain;
        }

        .nameCell {
            width: 150px;
            font-weight: bold;
            color: #4CAF50;
        }

        .statCell {
            width: 80px;
            text-align: right;
        }
    `;

    initialise();
}
