() => {

    return class MessageHandlerChain {

        #middlewares;

        constructor(middlewares) {
            this.#middlewares = MessageHandlerChain.#unpack(middlewares);
        }

        async handle(direction, message, sendMessage, executor) {
            await this.#pre(direction, message, sendMessage);
            await executor();
            await this.#post(direction, message, sendMessage);
        }

        async #pre() {
            for(const mw of this.#middlewares) {
                if(mw.pre) {
                    await mw.pre(...arguments);
                }
            }
        }

        async #post() {
            for(const mw of this.#middlewares.slice().reverse()) {
                if(mw.post) {
                    await mw.post(...arguments);
                }
            }
        }

        static #unpack(middlewares) {
            const result = [];
            for(const mw of middlewares) {
                if(mw.dependencies) {
                    result.push(...this.#unpack(mw.dependencies));
                }
                result.push(mw);
            }
            return result;
        }

    }

}
