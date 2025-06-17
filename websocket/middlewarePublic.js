(middlewareAuthenticated) => {

    const exports = {
        dependencies: [ middlewareAuthenticated ],
        pre,
        post,
        lookupDisplayName,
        getConnectedClients
    };

    const clientsPerKey = new Map(); // `${feature}:${channelId}` -> Array<{ displayName, publicId }>
    const displayNamePerPublicId = new Map(); // string -> string

    function pre(direction, message, _sendMessage) {
        if(direction === 'outgoing' && message.type === 'subscribe') {
            message.public = true;
        }
    }

    function post(direction, message, _sendMessage) {
        if(direction === 'incoming' && message.type === 'internal' && message.feature === 'close') {
            clientsPerKey.clear();
            displayNamePerPublicId.clear();
        }
        if(direction === 'incoming' && message.type === 'connectedClients') {
            const key = `${message.feature}:${message.channelId}`;
            clientsPerKey.set(key, message.payload);
            for(const client of message.payload) {
                displayNamePerPublicId.set(client.publicId, client.displayName);
            }
        }
    }

    function lookupDisplayName(publicId) {
        return displayNamePerPublicId.get(publicId);
    }

    function getConnectedClients(feature, channelId) {
        const key = `${feature}:${channelId}`;
        return clientsPerKey.get(key);
    }

    return exports;

}
