(MessageHandlerChain) => {

    return class FeatureRegistration {

        #subscribedChannels = new Set(); // Set<string>
        #socketSendMessage; // function(message)
        feature; // string
        #handlers; // type -> function(message)
        #chain; // MessageHandlerChain

        constructor(socketSendMessage, feature, handlers, middleware) {
            this.#socketSendMessage = socketSendMessage;
            this.feature = feature;
            this.#handlers = handlers;
            this.#chain = new MessageHandlerChain(middleware);
        }

        getSubscriptionCount() {
            return this.#subscribedChannels.size;
        }

        async subscribe(channelId) {
            // the order of changing subscriptions, and sending the message is important!
            await this.#sendMessage({
                type: 'subscribe',
                feature: this.feature,
                channelId
            });
            this.#subscribedChannels.add(channelId);
        }

        async unsubscribe(channelId) {
            // the order of changing subscriptions, and sending the message is important!
            this.#subscribedChannels.delete(channelId);
            await this.#sendMessage({
                type: 'unsubscribe',
                feature: this.feature,
                channelId
            });
        }

        resubscribeAll() {
            for(const channelId of this.#subscribedChannels) {
                this.subscribe(channelId);
            }
        }

        sendMessage(channelId, payload) {
            this.#sendMessage({
                type: 'message',
                feature: this.feature,
                channelId,
                payload
            });
        }

        async #sendMessage(message) {
            await this.#chain.handle('outgoing', message, this.#socketSendMessage, () => {
                this.#socketSendMessage(message);
            });
        }

        async handleMessage(message) {
            await this.#chain.handle('incoming', message, this.#socketSendMessage, async () => {
                if(this.#handlers[message.type]) {
                    await this.#handlers[message.type](message);
                }
            });
        }

    }

}