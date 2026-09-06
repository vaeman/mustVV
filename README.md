<h1>Delhi NCAir</h1>
<h2>Realtime AQI & Weather Forecasting system for Delhi NCR</h2>

<p>A Machine Learning based algorithm that can accurately predict the AQI of the city for the next 72 hours, using the historical data of local sensors, meteorological data and satellite data.</p>

<h2>Overview</h2>

<p>Due to the unfortunate geographical position, phenomena such as atmospheric inversion and agricultural practices such as stubble burning, Delhi has become notorious for it's horrendous air quality.</p>

<p>Our AQI and weather forecasting system aims on accurately predicting the Air Quality data on an hourly basis for the next 72 hours, by leveraging the AQI data from local sensors (Mandir Marg Monitoring System), fire information from <a href="https://modis.gsfc.nasa.gov/">satellite data</a>. The prediction is done by a gradient boosting model trained on <a href="openaq.org">data</a> from 2020-2022.</p>


<h2>Methodology</h2>

<p>Our Model works on 3 independent data sources: </p>
  <p>1. Fire Data from Satellites</p>
  <p>2. Local sensor data</p>
  <p>3. Wind Speeds</p>


<h2>Output</h2>

<img width="1389" height="790" alt="image" src="https://github.com/user-attachments/assets/7cc7569a-97c7-41a5-b914-2c4eb343839f" />

<p>Graph showing the forecast data for the next 72 hours.</p>
