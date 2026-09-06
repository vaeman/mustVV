# === Paste as a new cell at the END of your fixed notebook, after cell 20 ===

# 1) 72-hour forecast — already in exactly the shape the frontend needs
forecast_export = forecast_72h.copy()
forecast_export["datetime"] = forecast_export["datetime"].dt.tz_convert("UTC").dt.strftime("%Y-%m-%dT%H:%M:%SZ")
forecast_export = forecast_export.rename(columns={"hours_ahead": "hoursFromNow", "dominant_pollutant": "pollutant"})
forecast_export["pollutant"] = forecast_export["pollutant"].map({"pm25": "PM2.5", "pm10": "PM10"})
# weather isn't forecast by the model - carry the latest known reading across all 72 rows
latest_row = get_latest_conditions(test)
forecast_export["tempC"] = round(float(latest_row["temperature_C"]), 1)
forecast_export["windSpeed"] = round(float(latest_row["wind_speed"]) * 3.6, 1)  # m/s -> km/h
forecast_export["windDir"] = float(latest_row.get("wind_dir_deg", 0))
forecast_export[["hoursFromNow", "datetime", "aqi", "pollutant", "pm25", "pm10", "tempC", "windSpeed", "windDir"]] \
    .round(1).to_csv("forecast.csv", index=False)

# 2) Past 3 days, one row per day
hist = test.dropna(subset=["pm25", "pm10"]).copy()
hist["date"] = hist["datetime"].dt.date
daily = hist.groupby("date").agg(pm25=("pm25", "mean"), pm10=("pm10", "mean"),
                                  temperature_C=("temperature_C", "mean")).reset_index().tail(3)
daily["aqi"] = daily.apply(lambda r: compute_aqi({"pm25": r["pm25"], "pm10": r["pm10"]})[0], axis=1).round().astype(int)
daily[["date", "aqi", "temperature_C"]].rename(columns={"temperature_C": "tempC"}).round(1).to_csv("history.csv", index=False)

# 3) Current reading — single-row CSV
aqi_now, dom_now = compute_aqi({"pm25": latest_row["pm25"], "pm10": latest_row["pm10"]})
pd.DataFrame([{
    "aqi": round(aqi_now), "pollutant": "PM2.5" if dom_now == "pm25" else "PM10",
    "tempC": round(float(latest_row["temperature_C"]), 1),
    "feelsC": round(float(latest_row["temperature_C"]), 1),
    "windSpeed": round(float(latest_row["wind_speed"]) * 3.6, 1),
    "windDir": float(latest_row.get("wind_dir_deg", 0)),
    "lastUpdated": latest_row["datetime"].tz_convert("UTC").strftime("%Y-%m-%dT%H:%M:%SZ"),
}]).to_csv("current.csv", index=False)

print("Wrote forecast.csv, history.csv, current.csv")
