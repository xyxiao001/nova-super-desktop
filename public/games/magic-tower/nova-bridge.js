(function () {
    var FRAME_SOURCE = 'nova-magic-tower';
    var HOST_SOURCE = 'nova-desktop';
    var hostPausedBgm = false;
    var readySent = false;

    function send(type, payload) {
        window.parent.postMessage(Object.assign({
            source: FRAME_SOURCE,
            type: type
        }, payload || {}), '*');
    }

    function progress() {
        var game = window.core;
        if (!game || !game.status || !game.status.hero) return;
        send('progress', {
            progress: JSON.stringify({
                floorId: game.status.floorId,
                hard: game.status.hard,
                steps: game.status.hero.steps
            })
        });
    }

    function finish(result) {
        send('finished', { result: result });
    }

    function isGameReady() {
        return !!(
            window.main &&
            window.core &&
            window.main.core === window.core &&
            window.core.dom &&
            window.core.dom.startPanel
        );
    }

    function announceReady() {
        if (!isGameReady()) return false;
        if (!readySent) {
            readySent = true;
            send('ready');
        }
        return true;
    }

    window.NovaMagicTowerBridge = {
        finish: finish,
        progress: progress,
        ready: announceReady
    };

    window.addEventListener('message', function (event) {
        if (event.source !== window.parent || !event.data || event.data.source !== HOST_SOURCE) return;
        if (event.data.type === 'handshake') announceReady();
        if (event.data.type === 'deactivate' && window.core && window.core.pauseBgm) {
            hostPausedBgm = !!(
                window.core.musicStatus &&
                window.core.musicStatus.playingBgm
            );
            window.core.pauseBgm();
        }
        if (
            event.data.type === 'activate' &&
            hostPausedBgm &&
            window.core &&
            window.core.resumeBgm
        ) {
            hostPausedBgm = false;
            window.core.resumeBgm(true);
        }
        if (event.data.type === 'new-game') {
            window.location.reload();
        }
    });

    var readyTimer = window.setInterval(function () {
        if (announceReady()) window.clearInterval(readyTimer);
    }, 100);

    window.addEventListener('error', function (event) {
        send('error', {
            message: event.message || '游戏资源载入失败'
        });
    });

    window.addEventListener('unhandledrejection', function (event) {
        var reason = event.reason;
        send('error', {
            message: reason && reason.message
                ? reason.message
                : '游戏初始化失败'
        });
    });
})();
