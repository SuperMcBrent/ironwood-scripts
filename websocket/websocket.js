(Promise, FeatureRegistration) => {

    const exports = {
        register
    };

    const URL = 'ws://localhost:443';
    //const URL = 'wss://iwrpg.vectordungeon.com/websocket';
    const RECONNECT_INTERVAL = 3000;

    const registrations = []; // List<FeatureRegistration>
    let socket = null;
    let shouldReconnect = true;

    function register({ feature, handlers, middleware }) {
        if(!middleware) {
            middleware = [];
        }
        middleware.push({ pre }); // register ourselves as middleware
        const registration = new FeatureRegistration(sendMessage, feature, handlers, middleware);
        registrations.push(registration);
        return registration;
    }

    async function pre(direction, message) {
        if(direction === 'outgoing' && message.type === 'subscribe' && !getSubscriptionCount()) {
            await openConnection();
        }
        if(direction === 'outgoing' && message.type === 'unsubscribe' && !getSubscriptionCount()) {
            closeConnection();
        }
    }

    function getSubscriptionCount() {
        return registrations
            .map(a => a.getSubscriptionCount())
            .reduce((a,b) => a + b, 0);
    }

    function sendMessage(message) {
        if(socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(message));
        } else {
            console.warn('Socket not open. Message not sent:', message);
        }
    }

    async function handleMessage(message) {
        for(const registration of registrations) {
            if(message.feature === registration.feature) {
                await registration.handleMessage(message);
            }
        }
    }

    function closeConnection() {
        shouldReconnect = false;
        if(socket) {
            socket.close();
            socket = null;
            handleMessage({
                type: 'internal',
                feature: 'close'
            });
        }
    }

    function openConnection() {
        if(socket && socket.readyState <= 1) {
            return;
        }

        const websocketOpened = new Promise.Deferred('websocket.openConnection');

        shouldReconnect = true;
        socket = new WebSocket(URL);

        socket.addEventListener('open', () => {
            console.log('WebSocket connected');
            handleMessage({
                type: 'internal',
                feature: 'open'
            });
            for(const registration of registrations) {
                registration.resubscribeAll();
            }
            websocketOpened.resolve();
        });

        socket.addEventListener('close', () => {
            console.log('WebSocket closed');
            handleMessage({
                type: 'internal',
                feature: 'close'
            });
            if (shouldReconnect && getSubscriptionCount()) {
                setTimeout(openConnection, RECONNECT_INTERVAL);
            }
        });

        socket.addEventListener('error', (err) => {
            console.error('WebSocket error', err);
            socket.close();
        });

        socket.addEventListener('message', (event) => {
            try {
                handleMessage(JSON.parse(event.data));
            } catch(e) {
                console.warn('Invalid message:', event.data, e);
            }
        });

        return websocketOpened;
    }

    return exports;
}
