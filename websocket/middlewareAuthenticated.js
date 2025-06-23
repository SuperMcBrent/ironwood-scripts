(util) => {

    const exports = {
        post,
        getPrivateId: () => privateId,
        getPublicId: () => publicId,
        getDisplayName: () => displayName
    };

    const privateId = util.uuid(); // TODO from database
    const publicId = util.uuid(); // TODO from database
    const displayName = 'Pancake' + Math.floor(Math.random() * 1000); // TODO configurable

    function post(direction, message, sendMessage) {
        if (direction === 'incoming' && message.type === 'internal' && message.feature === 'open') {
            sendMessage({
                type: 'login',
                privateId,
                publicId,
                displayName
            });
        }
    }

    return exports;

}
