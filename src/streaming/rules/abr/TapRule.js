import SwitchRequest from '../SwitchRequest';
import FactoryMaker from '../../../core/FactoryMaker';
import EventBus from '../../../core/EventBus';
import Events from '../../../core/events/Events';
import Debug from '../../../core/Debug';
import MediaPlayerEvents from '../../MediaPlayerEvents';
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

    // 2023-6-25
    // add index in POST request
    let last_index = 0;

    function setup() {
        logger = Debug(context).getInstance().getLogger(instance);
        resetInitialSettngs();
        eventBus.on(Events.MEDIA_FRAGMENT_LOADED, onMediaFragmentLoaded, instance);
        eventBus.on(Events.VIDEO_CHUNK_RECEIVED, onVideoChunkReceived, instance);
    }

    function onVideoChunkReceived(e) {
        if (e.chunk.index) {
            last_index = e.chunk.index;
        }
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
        if (mediaType === "audio"){
            // only use ABR server for video
            return switchRequest;
        }
        const abrController = rulesContext.getAbrController();
        const throughputHistory = abrController.getThroughputHistory();

        const traceHistory = throughputHistory.getTraceHistory();
        console.log(`traceHistory: ${JSON.stringify(traceHistory)}`)
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
            last_index: last_index
        };
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
        last_index = 0;
    }

    function reset() {
        resetInitialSettngs();
        eventBus.off(MediaPlayerEvents.MEDIA_FRAGMENT_LOADED, onMediaFragmentLoaded, instance);
        eventBus.off(Events.VIDEO_CHUNK_RECEIVED, onVideoChunkReceived, instance);
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
