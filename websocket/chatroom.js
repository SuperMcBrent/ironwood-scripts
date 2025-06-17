(websocket, middlewarePublic) => {

    const exports = {
        register
    };

    function register({ feature, handleMessage, handleConnectedClients }) {
        const messagesByChannelId = {};
        const socketRegistration = websocket.register({
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
        return Object.assign(socketRegistration, {
            lookupDisplayName: middlewarePublic.lookupDisplayName,
            getConnectedClients: middlewarePublic.getConnectedClients.bind(null, feature),
            getHistory: channelId => messagesByChannelId[channelId] || []
        });
    }

    function internalHandleMessage(messagesByChannelId, message) {
        if(!messagesByChannelId[message.channelId]) {
            messagesByChannelId[message.channelId] = [];
        }
        messagesByChannelId[message.channelId].push(message);
    }

    return exports;

}
