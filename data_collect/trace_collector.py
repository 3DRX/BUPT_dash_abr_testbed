from flask import Flask, request, jsonify
from flask_cors import cross_origin, CORS
import logging

log = logging.getLogger("werkzeug").disabled = True

app = Flask(__name__)
app.debug = True
CORS(app, support_credentials=True)


class file_control:
    def __init__(self, file_name: str, columns: list[str]):
        self.__file = open(file_name, "a")
        self.append(",".join(columns))
        pass

    def append(self, data: str):
        self.__file.write(data + "\n")
        self.__file.flush()
        pass

    pass


fc = file_control(
    "video_chunk_data.csv",
    columns=[
        "downloadBytes",
        "startTime",
        "finishTime",
        "resolution",
        "chunkIndex",
    ],
)


@app.route("/trace", methods=["POST"])
@cross_origin()
def get_trace():
    req: dict = request.json
    print(req)
    fc.append(str(req["start"]) + "," + str(req["size"]))
    return jsonify({"response": "ok"})


@app.route("/on-new-video-chunk", methods=["POST"])
@cross_origin()
def post_on_new_video_chunk():
    req: dict = request.json
    print(req)
    fc.append(
        ",".join(
            [
                str(req["downloadBytes"]),
                str(req["startTime"]),
                str(req["finishTime"]),
                req["resolution"],
                str(req["chunkIndex"]),
            ]
        )
    )
    return jsonify({"response": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=False)
    pass
