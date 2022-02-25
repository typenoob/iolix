"use strict";
var request_1 = require("./request");
function getMovieData(id, episodeNum) {
    return request_1.request({
        url: "api/v2/movie/selectMovieInformation",
        method: 'post',
        params: {
            id: id,
            episodeNum: episodeNum
        }
    });
}
module.exports.getMovieData = getMovieData;
