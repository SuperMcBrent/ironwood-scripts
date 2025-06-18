(websocket, middlewarePublic, keyExchange) => {

    const exports = {
        register
    };

    const KEY_EXCHANGE_TYPE = 'privateChat';

    function initialize() {
        keyExchange.register();
    }

    function register({ feature, handleMessage, handleConnectedClients, handlePrivateChatRequest }) {
        const messagesByChannelId = {};
        const featureRegistration = websocket.register({
            feature,
            handlers: {
                message: message => {
                    internalHandleMessage(messagesByChannelId, message);
                    handleMessage(message);
                },
                connectedClients: handleConnectedClients
            },
            middleware: [ middlewarePublic ]
        });
        keyExchange.register(KEY_EXCHANGE_TYPE, handlePrivateChatRequest);
        return Object.assign(featureRegistration, {
            lookupDisplayName: middlewarePublic.lookupDisplayName,
            getConnectedClients: middlewarePublic.getConnectedClients.bind(null, feature),
            getHistory: channelId => messagesByChannelId[channelId] || [],
            setupPrivateChat
        });
    }

    function internalHandleMessage(messagesByChannelId, message) {
        if(!messagesByChannelId[message.channelId]) {
            messagesByChannelId[message.channelId] = [];
        }
        messagesByChannelId[message.channelId].push(message);
    }

    async function setupPrivateChat(publicId) {
        return await keyExchange.request('privateChat', publicId);
    }

    initialize();

    return exports;

}
