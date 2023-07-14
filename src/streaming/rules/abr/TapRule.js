import SwitchRequest from '../SwitchRequest';
import FactoryMaker from '../../../core/FactoryMaker';
import EventBus from '../../../core/EventBus';
import Events from '../../../core/events/Events';
import Debug from '../../../core/Debug';
import MediaPlayerEvents from '../../MediaPlayerEvents';
import Constants from '../../constants/Constants';
import URL_PREFIX from '../../constants/ExternalAbrServerConfig.js'
import $ from 'jquery';


function TapRule(config) {
    config = config || {};
    const context = this.context;

    const dashMetrics = config.dashMetrics;
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
        if (mediaType === Constants.AUDIO) {
            // only use ABR server for video
            return switchRequest;
        }
        const abrController = rulesContext.getAbrController();
        const scheduleController = rulesContext.getScheduleController();
        const playbackController = scheduleController.getPlaybackController();
        const throughputHistory = abrController.getThroughputHistory();

        const rebufferTime = playbackController.getTotalRebuffer();
        const traceHistory = throughputHistory.getTraceHistory();
        const last_chunk_index = throughputHistory.getCurrentChunkIndex();
        console.log(`chunk_index: ${last_chunk_index}`)
        const bufferLevel = dashMetrics.getCurrentBufferLevel(mediaType);
        const ladders = abrController.getBitrateList(mediaInfo);
        const lastBitrate = ladders[last_quality].bitrate;
        const duration = last_duration; // dashHandler.getNextSegmentByIndexForBupt(); // TODO: need impl.

        let choose_quality = -1;
        const data = {
            history: traceHistory,
            ladders: ladders,
            duration: duration,
            last_bitrate: lastBitrate,
            buffer_level: bufferLevel,
            last_index: last_chunk_index,
            rebuffer_time: rebufferTime
        };
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
        $.ajax({
            async: false,
            type: 'POST',
            contentType: 'application/json',
            dataType: 'json',
            url: `${URL_PREFIX}:8080/get_abr_result`,
            data: JSON.stringify(data),
            success: function(data) {
                choose_quality = data.quality;
                switchRequest.quality = choose_quality;
                switchRequest.reason = {};
                switchRequest.reason.throughput = data.estimate_throughput;
            },
            error: function(_) {
            }
        });
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

TapRule.__dashjs_factory_name = 'TapRule';
export default FactoryMaker.getClassFactory(TapRule);
