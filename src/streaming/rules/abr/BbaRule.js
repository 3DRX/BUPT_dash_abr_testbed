import MetricsConstants from '../../constants/MetricsConstants';
import SwitchRequest from '../SwitchRequest';
import FactoryMaker from '../../../core/FactoryMaker';
import { HTTPRequest } from '../../vo/metrics/HTTPRequest';
import EventBus from '../../../core/EventBus';
import Events from '../../../core/events/Events';
import Debug from '../../../core/Debug';
import MediaPlayerEvents from '../../MediaPlayerEvents';
import Constants from '../../constants/Constants';
import $ from 'jquery';
import URL_PREFIX from '../../constants/ExternalAbrServerConfig';


function BbaRule(config) {
    config = config || {};
    const context = this.context;

    const dashMetrics = config.dashMetrics;
    const mediaPlayerModel = config.mediaPlayerModel;
    const eventBus = EventBus(context).getInstance();

    let instance,
        logger,
        last_quality,
        last_duration;

    function setup() {
        logger = Debug(context).getInstance().getLogger(instance);
        resetInitialSettngs();

        eventBus.on(Events.MEDIA_FRAGMENT_LOADED, onMediaFragmentLoaded, instance);
    }

    function onMediaFragmentLoaded(e) {
        if (e && e.chunk && e.chunk.mediaInfo) {
            last_quality = e.chunk.quality;
            last_duration = e.chunk.duration;
        }
    }

    function getMaxIndex(rulesContext) {
        const switchRequest = SwitchRequest(context).create();

        if (!rulesContext || !rulesContext.hasOwnProperty('getMediaInfo') || !rulesContext.hasOwnProperty('getMediaType') ||
            !rulesContext.hasOwnProperty('getScheduleController') || !rulesContext.hasOwnProperty('getStreamInfo') ||
            !rulesContext.hasOwnProperty('getAbrController') || !rulesContext.hasOwnProperty('useBufferOccupancyABR')) {
            return switchRequest;
        }

        const mediaInfo = rulesContext.getMediaInfo();
        const mediaType = rulesContext.getMediaType();
        const abrController = rulesContext.getAbrController();
        const throughputHistory = abrController.getThroughputHistory();

        const scheduleController = rulesContext.getScheduleController();
        const rebufferTime = playbackController.getTotalRebuffer();
        const playbackController = scheduleController.getPlaybackController();
        const traceHistory = throughputHistory.getTraceHistory();
        const bufferLevel = dashMetrics.getCurrentBufferLevel(mediaType);
        const ladders = abrController.getBitrateList(mediaInfo);
        const lastBitrate = ladders[last_quality].bitrate;
        const duration = last_duration; // dashHandler.getNextSegmentByIndexForBupt(); // TODO: need impl.

        let choose_quality = -1;
        var data = {
            "buffer_level": bufferLevel
        };
        stop = false;
        if (mediaType === Constants.VIDEO) {
            const qoe = {
                rebuffer_time: rebufferTime,
                bitrate: lastBitrate,
                buffer_level: bufferLevel,
            }
            $.ajax({
                async: true,
                type: 'POST',
                contentType: 'application/json',
                dataType: 'json',
                url: `${URL_PREFIX}:8000/update_qoe`,
                data: JSON.stringify(qoe),
                success: function(_) {
                },
                error: function(e) {
                    console.log(e);
                }
            });
        }
        $.ajax({
            async: false,
            type: 'POST',
            contentType: 'application/json',
            dataType: 'json',
            url: `${URL_PREFIX}:8083/get_abr_result/`,
            data: JSON.stringify(data),
            success: function(data) {
                choose_quality = data.quality;
                switchRequest.quality = choose_quality;
                switchRequest.reason = {};
                switchRequest.reason.throughput = data.estimate_throughput;
                stop = true;
                console.log(data["estimate_throughput"]);
                // return switchRequest;
            },
            error: function(e) {
                console.log('[' + new Date().getTime() + '][BUPT-AJAX] ABR ERROR');
                stop = true;
                // return switchRequest;
            }
        });

        function sleep(numberMillis) {
            var now = new Date();
            var exitTime = now.getTime() + numberMillis;
            while (true) {
                now = new Date();
                if (now.getTime() > exitTime)
                    return;
            }
        }
        while (!stop) {
            sleep(10);
        }

        return switchRequest;
    }

    function resetInitialSettngs() {
        last_quality = -1;
        last_duration = -1;
    }

    function reset() {
        resetInitialSettngs();

        eventBus.off(MediaPlayerEvents.MEDIA_FRAGMENT_LOADED, onMediaFragmentLoaded, instance);
    }

    instance = {
        getMaxIndex: getMaxIndex,
        reset: reset
    }

    setup();
    return instance;
}

BbaRule.__dashjs_factory_name = 'BbaRule';
export default FactoryMaker.getClassFactory(BbaRule);
