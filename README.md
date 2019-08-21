# FlexSCADA Map Panel Plugin for Grafana

Based on the Grafana World Map Plugin (https://github.com/grafana/worldmap-panel) but allows for more device oriented display where markers can contain the results of queries and you can choose which query dictates color and size etc.




The FlexSCADA Map Panel is a tile map of the world that can be overlaid with circles representing data points from a query. It can be used with time series metrics

## How The Map Works (Theory and Examples)

The Map panel needs two sources of data:

- a location (latitude and longitude)
- data that has a link to a location

The data comes from a database query: Prometheus, InfluxDB, Graphite, Elasticsearch, MySQL etc. It must be in the Time Series format

### Time Series Format

If it is in the **Time Series format** then the metric name or alias needs to contain the location key in order to match a key from a list of locations. That key is usually a device ID or UUID. The list of locations can come from an HTTP endpoint.

The HTTP JSON endpoints return a list of locations and their coordinates

Time Series data contains a timestamp, a metric name and a numeric value.

The alias or metric name should be templated such that it provides a metric name in the following formatted

location_key:name:units
123313:Battery Voltage:Volts

Here is an example of what a query alias might look Like for influxDB
```
$tag_uid:$tag_label: Watts
```
This example uses the templated values for the UID and Label tags which the resulting data is grouped by


Location data should be in the JSON format and should be a list of JSON objects with four properties:

```json
{
    "body": {
        "2565543075": {
            "id": "2565543075",
            "lat": 50.6454,
            "lng": -120.767,
            "name": "Site 1"
        },
        "3104561261": {
            "id": "3104561261",
            "lat": 43.532,
            "lng": -119.545,
            "name": "Site 2"
        },
        "3290475136": {
            "id": "3290475136",
            "lat": 46.2774,
            "lng": -121.4235,
            "name": "Site 3"
        },
        "3958346536": {
            "id": "3958346536",
            "lat": 46.231,
            "lng": -121.9756,
            "name": "Site 4"
        },

    },
    "meta": {
        "code": 200
    }
}
```

The Endpoint URL has 1 templated variable '$appSubUrl' which can be used for linking to other dashboards

The Map Plugin will then match the metric name with a key field from the location data.

### Map Data Options

#### Marker Size and Color

The marker size and color can be set from the values returned from the database queries.

This is useful for example to visualize battery charge at remote sites for quick diagnostics.

The Metric Regexp fields for size and color should contain an expression that will match with the alias of a returned metric result.

For a metric titled 'battery voltage' you could simply put 'battery' in this field to match your metric and size or color your markers based on battery voltage

#### Marker link

Markers can have a link that opens for additional information.

Three variables can be used in the link field,
$uid and $name which correspond to the location unique identifier (key) and the location name
$appSubUrl which corresponds to the url that grafana is accessed at releative to the root domain i.e. /grafana

#### Aggregation

Aggregation specifies what value is shown in the marker details popup.

### Map Visual Option Settings

**Center**

This settings configures the default center of the map. There are 5 centers to choose from or you can choose a custom center or last marker center..For a custom center there are two fields: latitude and longitude. Examples of values are 37.09024, -95.712891 for the center of the US or 55.378051, -3.435973 for Great Britain. Last Marker center will centered the map on the last marker received from the location data.

**Initial Zoom**

The initial zoom factor for the map. This is a value between 1 and 18 where 1 is the most zoomed out.

**Min Circle Size**

This is minimum size for a circle in pixels.

**Max Circle Size**

This is the maximum size for a circle in pixels. Depending on the zoom level you might want a larger or smaller max circle size to avoid overlapping.

**Show Legend**

Shows/hide the legend on the bottom left that shows the threshold ranges and their associated colors.

### Threshold Options

Thresholds control the color of the circles.

If one value is specified then two colors are used. For example, if the threshold is set to 10 then values under 10 get the first color and values that are 10 or more get the second color.

The threshold field also accepts 2 or more comma-separated values. For example, if you have 2 values that represents 3 ranges that correspond to the three colors. For example: if the thresholds are 70, 90 then the first color represents < 70, the second color represents between 70 and 90 and the third color represents > 90.

### CHANGELOG
# FlexSCADA-Grafana-Map-Panel
