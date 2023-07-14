import SwitchRequest from '../SwitchRequest';
import FactoryMaker from '../../../core/FactoryMaker';
import EventBus from '../../../core/EventBus';
import Debug from '../../../core/Debug';
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
        logger;

    function setup() {
        logger = Debug(context).getInstance().getLogger(instance);
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
        const playbackController = scheduleController.getPlaybackController();
        const last_quality_index = throughputHistory.getQualityIndex();
        const rebufferTime = playbackController.getTotalRebuffer();
        const bufferLevel = dashMetrics.getCurrentBufferLevel(mediaType);
        const ladders = abrController.getBitrateList(mediaInfo);
        const lastBitrate = ladders[last_quality_index].bitrate;

        let choose_quality = -1;
        var data = {
            "buffer_level": bufferLevel
        };
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
                    // return switchRequest;
                },
                error: function(e) {
                    console.log('[' + new Date().getTime() + '][BUPT-AJAX] ABR ERROR');
                    stop = true;
                    // return switchRequest;
                }
            });
        }
        return switchRequest;
    }

    function reset() {
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
