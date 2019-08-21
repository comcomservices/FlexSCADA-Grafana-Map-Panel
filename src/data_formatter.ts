import * as _ from 'lodash';
import decodeGeoHash from './geohash';
import kbn from 'grafana/app/core/utils/kbn';

export default class DataFormatter {
  constructor(private ctrl) {}

  setValues(data) {
    if (this.ctrl.series && this.ctrl.series.length > 0) {
      let highestValue = Number.MIN_VALUE;
      let lowestValue = Number.MAX_VALUE;

      let geoData = {};

      this.ctrl.series.forEach(serie => {


        let series_alias = serie.alias.split(':'); // Split by space, first label is key


      // Check if we have the UID in the series alias
        if(series_alias.length < 2)
          return;

          // Get the UID
          let uid = series_alias[0].toUpperCase();

          // Get the matching location from the list of locations
          let location = this.ctrl.locations[uid];

        // If no location, exit
          if (!location)
            return;


          // If Invalid Location, Exit
          if(location.lat == null || location.lng == null) {
            console.log("Invalid Location for " + location.name)
            return;
          }


        // If no entry for specific location, create it!
        if(typeof geoData[uid] == "undefined")
          geoData[uid] = {
            location: location,
            sizeValue: 0,
            colorValue: 0,
            measurements: []
          };


          // Get the series value
          let value = serie.stats[this.ctrl.panel.valueName];

          // Get the series unit
          let unit = "";
          if(series_alias.length > 2)
            unit = series_alias[2];

          let label = series_alias[1];

          // Push series value to the list of measurements for each location
          geoData[uid].measurements.push({label: label, value: value, unit: unit});


          // Get the size value if applicable
          if(this.ctrl.panel.sizeMetricPattern){
          var reSize = new RegExp(this.ctrl.panel.sizeMetricPattern,"i");
          if(reSize.test(label)){
              geoData[uid].sizeValue = value;
              // Aggregation
              if (value > highestValue) {
                highestValue = value;
              }

              // Aggregation
              if (value < lowestValue) {
                lowestValue = value;
              }


          }
        }

          // Get the color value if applicable
          if(this.ctrl.panel.colorMetricPattern){
          var reColor = new RegExp(this.ctrl.panel.colorMetricPattern,"i");
          if(reColor.test(label)){
              geoData[uid].colorValue = value;
          }
        }


      });

      data.series = geoData;
      data.highestValue = highestValue;
      data.lowestValue = lowestValue;
      data.valueRange = highestValue - lowestValue;

      console.log(data);

    }


  }


  /*
  0:
key: "2084917486"
locationLatitude: 34.09024
locationLongitude: -95.712891
locationName: "Flexs Q5 A"
value: 12.103926
valueFormatted: 12.103926
valueRounded: 12
__proto__: Object


1:
key: "2084917487 Battery Voltage"
locationLatitude: 37.09024
locationLongitude: -95.712891
locationName: "Flexs Q5 B"
value: 3.465725
valueFormatted: 3.465725
valueRounded: 3
__proto__: Object
highestValue: 12.103926
lowestValue: 3.465725

thresholds: Array(2)
0: 0
1: 10
length: 2
__proto__: Array(0)

valueRange: 8.638200999999999
length: 2
__proto__: Array(0)
*/


  createDataValue(encodedGeohash, decodedGeohash, locationName, value) {
    const dataValue = {
      key: encodedGeohash,
      locationName: locationName,
      locationLatitude: decodedGeohash.latitude,
      locationLongitude: decodedGeohash.longitude,
      value: value,
      valueFormatted: value,
      valueRounded: 0,
    };

    dataValue.valueRounded = kbn.roundValue(dataValue.value, this.ctrl.panel.decimals || 0);
    return dataValue;
  }

  setGeohashValues(dataList, data) {
    if (!this.ctrl.panel.esGeoPoint || !this.ctrl.panel.esMetric) {
      return;
    }

    if (dataList && dataList.length > 0) {
      let highestValue = 0;
      let lowestValue = Number.MAX_VALUE;

      dataList.forEach(result => {
        if (result.type === 'table') {
          const columnNames = {};

          result.columns.forEach((column, columnIndex) => {
            columnNames[column.text] = columnIndex;
          });

          result.rows.forEach(row => {
            const encodedGeohash = row[columnNames[this.ctrl.panel.esGeoPoint]];
            const decodedGeohash = decodeGeoHash(encodedGeohash);
            const locationName = this.ctrl.panel.esLocationName
              ? row[columnNames[this.ctrl.panel.esLocationName]]
              : encodedGeohash;
            const value = row[columnNames[this.ctrl.panel.esMetric]];

            const dataValue = this.createDataValue(encodedGeohash, decodedGeohash, locationName, value);
            if (dataValue.value > highestValue) {
              highestValue = dataValue.value;
            }

            if (dataValue.value < lowestValue) {
              lowestValue = dataValue.value;
            }

            data.push(dataValue);
          });

          data.highestValue = highestValue;
          data.lowestValue = lowestValue;
          data.valueRange = highestValue - lowestValue;
        } else {
          result.datapoints.forEach(datapoint => {
            const encodedGeohash = datapoint[this.ctrl.panel.esGeoPoint];
            const decodedGeohash = decodeGeoHash(encodedGeohash);
            const locationName = this.ctrl.panel.esLocationName
              ? datapoint[this.ctrl.panel.esLocationName]
              : encodedGeohash;
            const value = datapoint[this.ctrl.panel.esMetric];

            const dataValue = this.createDataValue(encodedGeohash, decodedGeohash, locationName, value);
            if (dataValue.value > highestValue) {
              highestValue = dataValue.value;
            }
            if (dataValue.value < lowestValue) {
              lowestValue = dataValue.value;
            }
            data.push(dataValue);
          });

          data.highestValue = highestValue;
          data.lowestValue = lowestValue;
          data.valueRange = highestValue - lowestValue;
        }
      });
    }
  }

  static tableHandler(tableData) {
    const datapoints: any[] = [];

    if (tableData.type === 'table') {
      const columnNames = {};

      tableData.columns.forEach((column, columnIndex) => {
        columnNames[columnIndex] = column.text;
      });

      tableData.rows.forEach(row => {
        const datapoint = {};

        row.forEach((value, columnIndex) => {
          const key = columnNames[columnIndex];
          datapoint[key] = value;
        });

        datapoints.push(datapoint);
      });
    }

    return datapoints;
  }

  setTableValues(tableData, data) {
    if (tableData && tableData.length > 0) {
      let highestValue = 0;
      let lowestValue = Number.MAX_VALUE;

      tableData[0].forEach(datapoint => {
        let key;
        let longitude;
        let latitude;

        if (this.ctrl.panel.tableQueryOptions.queryType === 'geohash') {
          const encodedGeohash = datapoint[this.ctrl.panel.tableQueryOptions.geohashField];
          const decodedGeohash = decodeGeoHash(encodedGeohash);

          latitude = decodedGeohash.latitude;
          longitude = decodedGeohash.longitude;
          key = encodedGeohash;
        } else {
          latitude = datapoint[this.ctrl.panel.tableQueryOptions.latitudeField];
          longitude = datapoint[this.ctrl.panel.tableQueryOptions.longitudeField];
          key = `${latitude}_${longitude}`;
        }

        const dataValue = {
          key: key,
          locationName: datapoint[this.ctrl.panel.tableQueryOptions.labelField] || 'n/a',
          locationLatitude: latitude,
          locationLongitude: longitude,
          value: datapoint[this.ctrl.panel.tableQueryOptions.metricField],
          valueFormatted: datapoint[this.ctrl.panel.tableQueryOptions.metricField],
          valueRounded: 0,
        };

        if (dataValue.value > highestValue) {
          highestValue = dataValue.value;
        }

        if (dataValue.value < lowestValue) {
          lowestValue = dataValue.value;
        }

        dataValue.valueRounded = kbn.roundValue(dataValue.value, this.ctrl.panel.decimals || 0);
        data.push(dataValue);
      });

      data.highestValue = highestValue;
      data.lowestValue = lowestValue;
      data.valueRange = highestValue - lowestValue;
    }
  }

  setJsonValues(data) {
    if (this.ctrl.series && this.ctrl.series.length > 0) {
      let highestValue = 0;
      let lowestValue = Number.MAX_VALUE;

      this.ctrl.series.forEach(point => {
        const dataValue = {
          key: point.key,
          locationName: point.name,
          locationLatitude: point.latitude,
          locationLongitude: point.longitude,
          value: point.value !== undefined ? point.value : 1,
          valueRounded: 0,
        };
        if (dataValue.value > highestValue) {
          highestValue = dataValue.value;
        }
        if (dataValue.value < lowestValue) {
          lowestValue = dataValue.value;
        }
        dataValue.valueRounded = Math.round(dataValue.value);
        data.push(dataValue);
      });
      data.highestValue = highestValue;
      data.lowestValue = lowestValue;
      data.valueRange = highestValue - lowestValue;
    }
  }
}
