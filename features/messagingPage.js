(pages, components, configuration, events, elementCreator, modal, chatroom, middlewareAuthenticated) => {

    const PAGE_NAME = 'Messages';
    let chatroomRegistration;

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
        // this is an example of the public chat
        chatroomRegistration.subscribe('public');
        // this is an example of a private chat with yourself
        chatroomRegistration.subscribe('private-chat-' + middlewareAuthenticated.getPrivateId());
        // TODO add subscriptions for other private chats, it should be a channelId that was agreed to between 2 clients

        window.rerenderTest = function() {
            renderPage()
        };
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
        debugger;
        // TODO messages from not selected channels should be added to the right side, but a notification to the left
        const sender = chatroomRegistration.lookupDisplayName(message.senderId);
        console.log('received', message.payload, 'from', sender);

        const chatMessagesContainer = components.search(selectedConversationComponent, 'chatMessagesContainer');
        chatMessagesContainer.messages.push({
            time: message.time,
            content: {
                type: 'chat_message',
                sender,
                message: message.payload
            }
        });

        pages.requestRender(PAGE_NAME);
    }

    // TODO call this method on clicking chat on the left side
    function showChat(channelId) {
        // TODO save the mapping of messages in chatroom history, instead of having to remap it every time when switching channels
        const messages = chatroomRegistration.getHistory(channelId).map(a => ({
            time: a.time,
            content: {
                type: 'chat_message',
                sender: chatroomRegistration.lookupDisplayName(a.senderId),
                message: a.payload
            }
        }));
        // TODO show this disclaimer only for private chats
        messages.unshift(disclaimerMessage('channelId'));

        // TODO actually mark the selected chat as selected:true, and others selected:false
        pages.requestRender(PAGE_NAME);
    }

    function handleConnectedClients(message) {
        // TODO choose if this shows all users, or only the ones in the current chatroom
        // here, we'll only show the public chat
        if(message.channelId !== 'public') {
            return;
        }
        const availableRecipientsList = components.search(selectRecipientComponent, 'availableRecipientsList');
        availableRecipientsList.entries = message.payload.filter(a => a.publicId !== middlewareAuthenticated.getPublicId());

        pages.requestRender(PAGE_NAME);
    }

    function sendMessage(text) {
        // TODO determine channelId from selected chat
        chatroomRegistration.sendMessage('public', text);
    }

    async function renderPage() {
        // const header = components.search(componentBlueprint, 'header');
        // const list = components.search(componentBlueprint, 'list');

        // for (const index in changelogs) {
        //     header.title = changelogs[index].title;
        //     header.textRight = new Date(changelogs[index].time).toLocaleDateString();
        //     list.entries = changelogs[index].entries;
        //     components.addComponent(componentBlueprint);
        // }
        await renderLeftColumn();
        await renderRightColumn();
    }

    async function renderLeftColumn() {
        components.addComponent(conversationListComponent);
    }

    async function renderRightColumn() {
        components.addComponent(selectedConversationComponent);
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
            maxWidth: 300
        });
        selectRecipientComponent.parent = `#${modalId}`;

        components.addComponent(selectRecipientComponent);
    }

    async function createNewPrivateChat(displayName, publicId) {
        console.log(displayName, publicId);
        const newId = await chatroomRegistration.setupPrivateChat(publicId);
        chatroomRegistration.subscribe(`private-chat-${newId}`);
        // TODO actually show the created chat
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
        parent: 'MODAL ID GOES HERE',
        selectedTabIndex: 0,
        tabs: [{
            title: 'tab',
            rows: [{
                id: 'availableRecipientsList',
                type: 'listView',
                maxHeight: 500,
                render: ($element, item) => {
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
                        })
                    );
                    return $element;
                },
                entries: [{ // hardcoded for now, will be replaced with actual data later gather from legit messages
                    sender: "Yourself",
                    time: "12:45 PM",
                    lastMessage: "Please respond to my messages.",
                    unreadCount: 9,
                    selected: true
                }, {
                    sender: "Sexy Lady",
                    time: "12:45 PM",
                    lastMessage: "*image*",
                    unreadCount: 1
                }, {
                    sender: "Miccyboye",
                    time: "12:45 PM",
                    lastMessage: "I'm sorry to inform you you're banned again for violating tos.",
                    unreadCount: 1
                }, {
                    sender: "LEROY JENKINS",
                    time: "12:45 PM",
                    lastMessage: "IM GOING IN!",
                    unreadCount: 1
                }, {
                    sender: "Santa Claus",
                    time: "12:45 PM",
                    unreadCount: 0
                }, {
                    sender: "Patt",
                    time: "12:45 PM",
                    lastMessage: "You have been invited to join the Rift Guild Chat.",
                    unreadCount: 0
                }, {
                    sender: "Sexy Lady",
                    time: "12:45 PM",
                    lastMessage: "*image*",
                    unreadCount: 1
                }, {
                    sender: "Miccyboye",
                    time: "12:45 PM",
                    lastMessage: "I'm sorry to inform you you're banned again for violating tos.",
                    unreadCount: 1
                }, {
                    sender: "LEROY JENKINS",
                    time: "12:45 PM",
                    lastMessage: "IM GOING IN!",
                    unreadCount: 1
                }, {
                    sender: "Santa Claus",
                    time: "12:45 PM",
                    unreadCount: 0
                }, {
                    sender: "Patt",
                    time: "12:45 PM",
                    lastMessage: "You have been invited to join the Rift Guild Chat.",
                    unreadCount: 0
                }, {
                    sender: "Sexy Lady",
                    time: "12:45 PM",
                    lastMessage: "*image*",
                    unreadCount: 1
                }, {
                    sender: "Miccyboye",
                    time: "12:45 PM",
                    lastMessage: "I'm sorry to inform you you're banned again for violating tos.",
                    unreadCount: 1
                }, {
                    sender: "LEROY JENKINS",
                    time: "12:45 PM",
                    lastMessage: "IM GOING IN!",
                    unreadCount: 1
                }, {
                    sender: "Santa Claus",
                    time: "12:45 PM",
                    unreadCount: 0
                }, {
                    sender: "Patt",
                    time: "12:45 PM",
                    lastMessage: "You have been invited to join the Rift Guild Chat.",
                    unreadCount: 0
                }]
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
            scrollChatToBottom()
        },
        tabs: [{
            title: 'private-message-tab',
            rows: [{
                id: 'privateMessageHeader',
                type: 'header',
                title: `Your conversation with yourself`,
            }, {
                id: 'chatMessagesContainer',
                type: 'chat',
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
    `;

    initialise();

}
