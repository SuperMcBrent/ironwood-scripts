(pages, components, configuration, events, elementCreator, modal, chatroom, middlewareAuthenticated, util) => {

    const PAGE_NAME = 'Messages';
    let chatroomRegistration;

    const chats = [
        {
            channelId: 'public',
            active: true
        },
        {
            channelId: 'private-chat-' + middlewareAuthenticated.getPrivateId()
        }
    ]

    async function initialise() {
        await pages.register({
            category: 'Communication',
            //after: 'Changelog',
            name: PAGE_NAME,
            image: 'https://cdn-icons-png.flaticon.com/512/610/610413.png',
            columns: 2,
            render: renderPage
        });
        configuration.registerCheckbox({
            category: 'Pages',
            key: 'messages-enabled',
            name: 'Messaging',
            default: true, // TODO: Change to false when ready
            handler: handleConfigStateChange
        });
        elementCreator.addStyles(styles);
        events.register('page', hanglePageEvent);
        chatroomRegistration = chatroom.register({
            feature: 'chatroom-test',
            handleMessage,
            handleConnectedClients,
            handlePrivateChatRequest
        });

        chats.forEach(chat => {
            chatroomRegistration.subscribe(chat.channelId);
        });

        // TODO add subscriptions for other private chats, it should be a channelId that was agreed to between 2 clients

        // store conversations / channelIds in local storage ??

        rebuildChatList();

        window.rerenderTest = function () {
            renderPage()
        };

        window.dump = function () {
            console.log('Chats:', chats);
            console.log('Chatroom Registration:', chatroomRegistration);
            console.log('Active Chat:', chats.find(chat => chat.active));
            console.log('Chat History for Public Channel:', chatroomRegistration.getHistory('public'));
            console.log('Chat History for Private Channel:', chatroomRegistration.getHistory(`private-chat-${middlewareAuthenticated.getPrivateId()}`));
            console.log('Conversation List Component:', conversationListComponent);
            console.log('Selected Conversation Component:', selectedConversationComponent);
            console.log('Select Recipient Component:', selectRecipientComponent);
        }
    }

    function handleConfigStateChange(state) {
        if (state) {
            pages.show(PAGE_NAME);
        } else {
            pages.hide(PAGE_NAME);
        }
    }

    function hanglePageEvent() {
        modal.close();
        //to track when a user leaves this page to start accumulating missed message notifications
        if (events.getLast('page').type !== PAGE_NAME.toLowerCase()) {
            return;
        }
    }

    function handleMessage(message) {

        console.log('received message', message);
        const sender = chatroomRegistration.lookupDisplayName(message.senderId);
        console.log('received', message.payload, 'from', sender);

        // for active chat, rebuild the chat messages
        rebuildActiveChat()

        // for any message, rebuild the chat list
        rebuildChatList();

        renderPage()
    }

    function rebuildActiveChat() {

        // TODO save the mapping of messages in chatroom history, instead of having to remap it every time when switching channels

        // HOLUP remapping everytime is fine imo, guarantees fresh and uptodate data, only map last 100 messages
        // if msgcount > 100 and scrolltop is 0 show button "load more messages"

        // TODO show this disclaimer only for private chats // alternate disclaimer for group chats

        const activeChat = chats.find(chat => chat.active);
        const chatMessagesContainer = components.search(selectedConversationComponent, 'chatMessagesContainer');
        const messages = chatroomRegistration.getHistory(activeChat.channelId).map(a => ({
            time: a.time,
            content: {
                type: 'chat_message',
                sender: chatroomRegistration.lookupDisplayName(a.senderId),
                message: a.payload
            }
        }));

        chatMessagesContainer.messages = [disclaimerMessage(activeChat.channelId), ...messages];
    }

    function rebuildChatList() {

        // TODO add notification for the left side, if the chat is not active

        const conversationsList = components.search(conversationListComponent, 'chatsList');
        conversationsList.entries = chats.map(chat => {
            const history = chatroomRegistration.getHistory(chat.channelId);
            const last = history.at(-1);

            const lastMessage = last ? {
                time: last.time,
                content: {
                    type: 'chat_message',
                    sender: chatroomRegistration.lookupDisplayName(last.senderId),
                    message: last.payload
                }
            } : null;

            return {
                sender: chat.channelId, // lastMessage sender, what if no message yet, somehow get chat from channelId
                time: lastMessage?.time ? util.unixToHMS(lastMessage.time) : '-',
                lastMessage: lastMessage?.content?.message || 'No messages yet',
                unreadCount: 1,
                selected: chat.active,
                channelId: chat.channelId
            };
        });
    }

    function showChat(channelId) {

        chats.forEach(chat => {
            chat.active = false;

            if (chat.channelId === channelId) {
                chat.active = true;
            }
        });

        rebuildChatList();
        rebuildActiveChat();

        renderPage()
    }

    function handleConnectedClients(message) {
        console.log(message);
        // TODO choose if this shows all users, or only the ones in the current chatroom
        // here, we'll only show the public chat
        if (message.channelId !== 'public') {
            return;
        }

        // Update the list of available recipients in the selectRecipientComponent
        const availableRecipientsList = components.search(selectRecipientComponent, 'availableRecipientsList');
        availableRecipientsList.entries = message.payload.filter(a => a.publicId !== middlewareAuthenticated.getPublicId());
        if (availableRecipientsList.entries.length === 0) {
            availableRecipientsList.entries.push({
                empty: true,
            });
        }

        renderPage()
    }

    function sendMessage(text) {
        const activeChat = chats.find(chat => chat.active);
        if (!activeChat) {
            console.error('No active channel to send message to');
            return;
        }
        chatroomRegistration.sendMessage(activeChat.channelId, text);
    }

    async function renderPage() {
        await components.addComponent(conversationListComponent);
        await components.addComponent(selectedConversationComponent);
        await components.addComponent(selectRecipientComponent);
    }

    function disclaimerMessage(otherPartyName) {
        const disclaimerMessage = {
            content: {
                type: 'chat_system',
                message: `@C:red@Do NOT share your account password with anyone. This is a private, encrypted channel for you and ${otherPartyName}. Note: This chat is *not* affiliated with the game or its developers.`,
            }
        }
        return disclaimerMessage;
    }

    async function showCreateNewChat() {
        const modalId = await modal.create({
            title: 'Select a recipient',
            image: 'https://cdn-icons-png.flaticon.com/512/7887/7887065.png',
            maxWidth: 300,
            onclose: () => {
                selectRecipientComponent.parent = null;
            } // maybe move to modal with ref
        });
        selectRecipientComponent.parent = `#${modalId}`;

        await components.addComponent(selectRecipientComponent);
    }

    async function createNewPrivateChat(displayName, publicId) {
        console.log(displayName, publicId);
        const newId = await chatroomRegistration.setupPrivateChat(publicId);

        const newChat = {
            channelId: `private-chat-${newId}`
        }
        chats.push(newChat);
        chatroomRegistration.subscribe(newChat.channelId);
        // TODO actually show the created chat
        // set as active
    }

    function handlePrivateChatRequest(message) {
        chatroomRegistration.subscribe(`private-chat-${message.payload.key}`);
        // TODO actually show the created chat (message.senderId is the other party)
    }

    function scrollChatToBottom() {
        const $container = $('#chatMessagesContainer');
        if ($container.length) {
            $container.scrollTop($container[0].scrollHeight);
        }
    }

    const selectRecipientComponent = {
        componentId: 'selectRecipientComponent',
        dependsOn: 'custom-page',
        parent: null, //'MODAL ID GOES HERE',
        selectedTabIndex: 0,
        tabs: [{
            title: 'tab',
            rows: [{
                id: 'availableRecipientsList',
                type: 'listView',
                maxHeight: 500,
                render: ($element, item) => {
                    console.log('rendering item', item);

                    if (item.empty) {
                        $element.removeClass('listViewElement');
                        $element.append(
                            $('<div/>').addClass('selectRecipientComponentNoAvailableRecipients').append(
                                $('<span/>').text('No recipients found')
                            )
                        );
                        return $element;
                    }

                    $element.append(
                        $('<div/>').addClass('selectRecipientComponentItemWrapper').append(
                            $('<span/>').addClass('selectRecipientComponentItemName').text(String(item.displayName || 'Unnamed'))
                        ).on('click', () => {
                            createNewPrivateChat(item.displayName, item.publicId);
                            modal.close();
                        })
                    );
                    return $element;
                },
                entries: []
            }]
        }]
    };

    const conversationListComponent = {
        componentId: 'leftColumnComponent',
        dependsOn: 'custom-page',
        parent: '.column0',
        selectedTabIndex: 0,
        tabs: [{
            title: 'tab',
            rows: [{
                id: 'header',
                type: 'header',
                title: 'Inbox',
                // action: showCreateNewChat,
                name: 'New Chat',
            }, {
                id: 'chatsList',
                type: 'listView',
                maxHeight: 700,
                render: ($element, item) => {
                    if (item.selected) $element.addClass('selected')
                    $element.append(
                        $('<div/>').addClass('chatListViewContent').append(
                            $('<div/>').addClass('chatListViewTop').append(
                                $('<span/>').addClass('chatListViewSender').text(String(item.sender || 'Unknown')),
                                $('<span/>').addClass('chatListViewTimestamp').text(String(item.time || ''))
                            ),
                            $('<div/>').addClass('chatListViewBottom').append(
                                $('<span/>').addClass('chatListViewLastMessage').text(item.lastMessage ? String(item.lastMessage) : 'No messages yet'),
                                $('<span/>').addClass('chatListViewNotification').text(
                                    item.unreadCount > 0 ? (String(item.unreadCount) + ' new') : ''
                                )
                            )
                        ).on('click', () => {
                            console.log(item);
                            showChat(item.channelId);
                        })
                    );
                    return $element;
                },
                entries: []
            }, {
                type: 'buttons',
                buttons: [{
                    text: 'New Chat',
                    color: 'success',
                    action: showCreateNewChat
                }]
            }]
        }]
    };

    const selectedConversationComponent = {
        componentId: 'rightColumnComponent',
        dependsOn: 'custom-page',
        parent: '.column1',
        selectedTabIndex: 0,
        after: () => {
            //scrollChatToBottom(); // overrides the keepscrollpostion behaviour
            // TODO should no longer work because repaints happen all the time, remove from here and execute on message received for active channel
        },
        tabs: [{
            title: 'private-message-tab',
            rows: [{
                id: 'privateMessageHeader',
                type: 'header',
                title: `Your conversation with yourself`,
            }, {
                id: 'chatMessagesContainer',
                type: 'chat', // TODO change to listView
                maxHeight: 700,
                inputPlaceholder: 'Type a message...',
                inputType: 'text',
                inputValue: '',
                inputLayout: '1/6',
                messages: [disclaimerMessage('yourself')],
                action: () => setTimeout(() => renderPage(), 100), // onfocusout
                submit: sendMessage
            }]
        }]
    };

    const styles = `
        .chatListViewContent {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
            padding: 0.75rem 1rem;
            justify-content: space-between;
        }
        .chatListViewTop,
        .chatListViewBottom {
            display: flex;
            justify-content: space-between;
            padding: 0 0.25rem;
        }
        .chatListViewSender {
            font-weight: bold;
        }
        .chatListViewTimestamp {
            color: #999;
            font-size: 0.85em;
        }
        .chatListViewLastMessage {
            color: #ccc;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 70%;
        }
        .chatListViewNotification {
            color: white;
            background-color: #b35c5c;
            font-size: 0.75em;
            border-radius: 10px;
            padding: 0 6px;
            align-self: center;
        }
        .selectRecipientComponentItemWrapper {
            display: flex;
            align-items: center;
            padding: 0.5rem 0.75rem;
            width: 100%;
        }
        .selectRecipientComponentItemName {
            font-size: 0.95rem;
            font-weight: 500;
            color: #ddd;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .selectRecipientComponentNoAvailableRecipients {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0.5rem 0.75rem;
            width: 100%;
        }
    `;

    initialise();

}
