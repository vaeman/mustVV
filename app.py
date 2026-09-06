import numpy as np
import pandas as pd
import joblib
from flask import Flask, jsonify, request
from flask_cors import CORS

BUNDLE_PATH = "aqi_model_bundle.pkl"
bundle = joblib.load(BUNDLE_PATH)
models = bundle["models"]              # {"pm25": model, "pm10": model}
recent_data = bundle["recent_data"]    # continuous hourly df with FEATURES + datetime + pm25/pm10

FEATURES = [
    "hour_of_day", "day_of_week", "month", "is_rush_hour",
    "pm25_lag1", "pm25_lag2", "pm25_lag3", "pm25_lag6", "pm25_lag12", "pm25_lag24",
    "pm10_lag1", "pm10_lag2", "pm10_lag3", "pm10_lag6", "pm10_lag12", "pm10_lag24",
    "wind_speed", "temperature_C",
    "fires_last_24h", "fires_last_48h", "fires_last_72h",
    "frp_last_24h", "frp_last_48h", "frp_last_72h",
]

# Same fixed, contiguous breakpoints as the notebook
BREAKPOINTS = {
    "pm25": [(0, 30, 0, 50), (30, 60, 50, 100), (60, 90, 100, 200),
             (90, 120, 200, 300), (120, 250, 300, 400), (250, 500, 400, 500)],
    "pm10": [(0, 50, 0, 50), (50, 100, 50, 100), (100, 250, 100, 200),
             (250, 350, 200, 300), (350, 430, 300, 400), (430, 700, 400, 500)],
}
POLLUTANT_DISPLAY = {"pm25": "PM2.5", "pm10": "PM10"}


def concentration_to_subindex(conc, pollutant):
    bps = BREAKPOINTS[pollutant]
    conc = max(conc, 0)
    for bp_lo, bp_hi, i_lo, i_hi in bps:
        if bp_lo <= conc <= bp_hi:
            return i_lo + (i_hi - i_lo) / (bp_hi - bp_lo) * (conc - bp_lo)
    return bps[-1][3]


def compute_aqi(row):
    subs = {p: concentration_to_subindex(row[p], p) for p in ["pm25", "pm10"]}
    dominant = max(subs, key=subs.get)
    return subs[dominant], dominant


def get_latest_conditions(df):
    return df.sort_values("datetime").dropna(subset=FEATURES).iloc[-1]


def time_features_for(target_datetime, latest_row):
    row = latest_row[FEATURES].to_dict()
    row["hour_of_day"] = target_datetime.hour
    row["day_of_week"] = target_datetime.dayofweek
    row["month"] = target_datetime.month
    row["is_rush_hour"] = int(target_datetime.hour in [8, 9, 19, 20, 21])
    return row


def forecast_next_n(hours=72):
    latest_row = get_latest_conditions(recent_data)
    latest_time = latest_row["datetime"]

    rows, times = [], []
    for h in range(1, hours + 1):
        target_time = latest_time + pd.Timedelta(hours=h)
        row = time_features_for(target_time, latest_row)
        row["horizon"] = h
        rows.append(row)
        times.append(target_time)
    X = pd.DataFrame(rows)[FEATURES + ["horizon"]]

    preds = {p: np.clip(m.predict(X), 0, None) for p, m in models.items()}

    out = []
    for i, t in enumerate(times):
        pm25, pm10 = float(preds["pm25"][i]), float(preds["pm10"][i])
        aqi, dom = compute_aqi({"pm25": pm25, "pm10": pm10})
        out.append({
            "hoursFromNow": i + 1,
            "datetime": t.isoformat(),
            "aqi": round(aqi),
            "pollutant": POLLUTANT_DISPLAY[dom],
            "pm25": round(pm25, 1),
            "pm10": round(pm10, 1),
            # NOTE: the model only forecasts pm25/pm10 — temperature and wind
            # aren't predicted ahead, so we carry the latest known reading
            # forward. Train a small regressor on temperature_C/wind_speed
            # the same way as pm25/pm10 later if you want these to move too.
            "tempC": round(float(latest_row["temperature_C"]), 1),
            "windSpeed": round(float(latest_row["wind_speed"]) * 3.6, 1),  # m/s -> km/h
            "windDir": float(latest_row.get("wind_dir_deg", 0)),
        })
    return out


app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app)  # not needed if you serve the frontend from this same Flask app


@app.route("/")
def index():
    return app.send_static_file("index.html")


@app.route("/api/current")
def current():
    latest_row = get_latest_conditions(recent_data)
    aqi, dom = compute_aqi({"pm25": latest_row["pm25"], "pm10": latest_row["pm10"]})
    return jsonify({
        "aqi": round(aqi),
        "pollutant": POLLUTANT_DISPLAY[dom],
        "tempC": round(float(latest_row["temperature_C"]), 1),
        "feelsC": round(float(latest_row["temperature_C"]), 1),
        "windSpeed": round(float(latest_row["wind_speed"]) * 3.6, 1),
        "windDir": float(latest_row.get("wind_dir_deg", 0)),
        "lastUpdated": latest_row["datetime"].isoformat(),
    })


@app.route("/api/history")
def history():
    days = int(request.args.get("days", 3))
    df = recent_data.dropna(subset=["pm25", "pm10"]).copy()
    df["date"] = df["datetime"].dt.date
    daily = (
        df.groupby("date")
        .agg(pm25=("pm25", "mean"), pm10=("pm10", "mean"), temperature_C=("temperature_C", "mean"))
        .reset_index()
        .tail(days)
    )
    out = []
    for _, r in daily.iterrows():
        aqi, _ = compute_aqi({"pm25": r["pm25"], "pm10": r["pm10"]})
        out.append({"date": str(r["date"]), "aqi": round(aqi), "tempC": round(float(r["temperature_C"]), 1)})
    return jsonify(out)


@app.route("/api/forecast")
def forecast():
    hours = int(request.args.get("hours", 72))
    return jsonify(forecast_next_n(hours=hours))


if __name__ == "__main__":
    app.run(port=5000, debug=True)
