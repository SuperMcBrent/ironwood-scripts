(websocket, Promise, util) => {

    // TODO enable/disable with global websocket toggle ? otherwise, the websockets always opens

    const exports = {
        request,
        register
    };

    let featureRegistration;
    const outstandingRequests = {};
    const callbacks = {};

    function initialize() {
        featureRegistration = websocket.register({
            feature: 'keyExchange',
            handlers: {
                message: handleMessage
            }
        });
    }

    function request(type, publicId) {
        const key = `${type}:${publicId}`;
        const resolved = new Promise.Expiring(2000, `keyExchange - ${key}`);
        if(outstandingRequests[key]) {
            outstandingRequests[key].reject();
        }
        outstandingRequests[key] = resolved;

        featureRegistration.sendMessage(publicId, {
            type,
            direction: 'req',
            key: util.uuid()
        });

        return resolved;
    }

    function register(type, callback) {
        if(callbacks[type]) {
            throw `callback of type ${type} already registered`;
        }
        callbacks[type] = callback;
    }

    function handleMessage(message) {
        if(message.payload.direction === 'req') {
            if(callbacks[message.payload.type]) {
                callbacks[message.payload.type](message);
            }
            featureRegistration.sendMessage(message.senderId, {
                type: message.payload.type,
                direction: 'ack',
                key: message.payload.key
            });
        }
        if(message.payload.direction === 'ack') {
            const key = `${message.payload.type}:${message.senderId}`;
            if(outstandingRequests[key]) {
                outstandingRequests[key].resolve(message.payload.key);
            }
        }
    }

    initialize();

    return exports;

}
