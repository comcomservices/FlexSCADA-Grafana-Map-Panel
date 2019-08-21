import * as _ from 'lodash';
import * as L from './libs/leaflet';
import WorldmapCtrl from './worldmap_ctrl';

const tileServers = {
  'CartoDB Positron': {
    url: 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
      '&copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
    subdomains: 'abcd',
  },
  'CartoDB Dark': {
    url: 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
      '&copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
    subdomains: 'abcd',
  },
};

/*
light_all,
dark_all,
light_nolabels,
light_only_labels,
dark_nolabels,
dark_only_labels,
*/

export default class WorldMap {
  ctrl: WorldmapCtrl;
  mapContainer: any;
  circles: any[];
  map: any;
  legend: any;
  circlesLayer: any;

  constructor(ctrl, mapContainer) {
    this.ctrl = ctrl;
    this.mapContainer = mapContainer;
    this.circles = [];
  }

  createMap() {
    const mapCenter = (<any>window).L.latLng(
      parseFloat(this.ctrl.panel.mapCenterLatitude),
      parseFloat(this.ctrl.panel.mapCenterLongitude)
    );
    this.map = L.map(this.mapContainer, {
      worldCopyJump: true,
      preferCanvas: true,
      center: mapCenter,
      zoom: parseInt(this.ctrl.panel.initialZoom, 10) || 1,
    });
    this.setMouseWheelZoom();

    const selectedTileServer = tileServers[this.ctrl.tileServer];
    (<any>window).L.tileLayer(selectedTileServer.url, {
      maxZoom: 18,
      subdomains: selectedTileServer.subdomains,
      reuseTiles: true,
      detectRetina: true,
      attribution: selectedTileServer.attribution,
    }).addTo(this.map);
  }

  createLegend() {

    this.legend = (<any>window).L.control({ position: 'bottomleft' });
    this.legend.onAdd = () => {
      this.legend._div = (<any>window).L.DomUtil.create('div', 'info legend');
      this.legend.update();
      return this.legend._div;
    };

    this.legend.update = () => {
      const thresholds = this.ctrl.data.thresholds;
      let legendHtml = '';
      legendHtml +=
        '<div class="legend-item"><i style="background:' +
        this.ctrl.panel.colors[0] +
        '"></i> ' +
        '&lt; ' +
        thresholds[0] +
        '</div>';
      for (let index = 0; index < thresholds.length; index += 1) {
        legendHtml +=
          '<div class="legend-item"><i style="background:' +
          this.ctrl.panel.colors[index + 1] +
          '"></i> ' +
          thresholds[index] +
          (thresholds[index + 1] ? '&ndash;' + thresholds[index + 1] + '</div>' : '+');
      }
      this.legend._div.innerHTML = legendHtml;
    };
    this.legend.addTo(this.map);

  }

  needToRedrawCircles(data) {
    if (this.circles.length === 0 && data.length > 0) {
      return true;
    }

    if (this.circles.length !== data.length) {
      return true;
    }


    const locations = _.map(_.map(this.circles, 'options'), 'location').sort();
    const dataPoints = _.map(data, 'id').sort();
    return !_.isEqual(locations, dataPoints);
  }

  filterEmptyAndZeroValues(data) {
    return _.filter(data, o => {
    //  return !(this.ctrl.panel.hideEmpty && _.isNil(o.value)) && !(this.ctrl.panel.hideZero && o.value === 0);
        return !(this.ctrl.panel.hideEmpty && !o.measurements.length);
    });
  }

  clearCircles() {
    if (this.circlesLayer) {
      this.circlesLayer.clearLayers();
      this.removeCircles();
      this.circles = [];
    }
  }

  drawCircles() {
    const data = this.filterEmptyAndZeroValues(this.ctrl.data.series);
    if (this.needToRedrawCircles(data)) {
      this.clearCircles();
      this.createCircles(data);
    } else {
      this.updateCircles(data);
    }
  }

  createCircles(data) {
    const circles: any[] = [];
    data.forEach(series => {
      if (!series.location.name) {
        return;
      }
      circles.push(this.createCircle(series));
    });
    this.circlesLayer = this.addCircles(circles);
    this.circles = circles;
  }

  updateCircles(data) {
    data.forEach(series => {
      if (!series.location.name) {
        return;
      }



      const circle = _.find(this.circles, cir => {
        return cir.options.location === series.id;
      });

      if (circle) {

        circle.setRadius(this.calcCircleSize(series.sizeValue || 0));
        circle.setStyle({
          color: this.getColor(series.colorValue),
          fillColor: this.getColor(series.colorValue),
          fillOpacity: 0.5,
          location: series.id,
        });
        circle.unbindPopup();
        this.createPopup(circle, series);
      }
    });
  }

  createCircle(series) {
    const circle = (<any>window).L.circleMarker([series.location.lat, series.location.lng], {
      radius: this.calcCircleSize(series.sizeValue || 0),
      color: this.getColor(series.colorValue),
      fillColor: this.getColor(series.colorValue),
      fillOpacity: 0.5,
      location: series.location.id,
      clickable: true,
    });

    this.createPopup(circle, series);
    return circle;
  }

  calcCircleSize(dataPointValue) {
    const circleMinSize = parseInt(this.ctrl.panel.circleMinSize, 10) || 2;
    const circleMaxSize = parseInt(this.ctrl.panel.circleMaxSize, 10) || 30;

    if (this.ctrl.data.valueRange === 0) {
      return circleMaxSize;
    }

    const dataFactor = (dataPointValue - this.ctrl.data.lowestValue) / this.ctrl.data.valueRange;
    const circleSizeRange = circleMaxSize - circleMinSize;

    return circleSizeRange * dataFactor + circleMinSize;
  }



  createPopup(circle, series) {
  //  const unit = value && value === 1 ? this.ctrl.panel.unitSingular : this.ctrl.panel.unitPlural;

     let label = "<h2>" + series.location.name + "</h2>";

     series.measurements.forEach(measurement => {

       if(  !(  (this.ctrl.panel.hideEmpty && _.isNil(measurement.value)  ) || (this.ctrl.panel.hideZero && measurement.value === 0) )  )
       {
         label += "<b>" + measurement.label + ":</b> " + measurement.value.toFixed(this.ctrl.panel.decimals) + measurement.unit + "<br>";
       }


     });



      //  const scopedVars = {};

        let uid = series.location.id;
        let name = series.location.name;
    //    scopedVars["__uid"] =  { value: uid, text: uid ? uid.toString() : '' };

if(this.ctrl.panel.linkUrl.length){
        // const linkURL = this.templateSrv.replace(this.ctrl.panel.linkUrl, scopedVars, encodeURIComponent);
        // const linkTitle = this.templateSrv.replace(this.ctrl.panel.linkTitle, scopedVars);

         let linkURL = this.ctrl.panel.linkUrl.replace("$uid",uid);
         let linkTitle = this.ctrl.panel.linkTitle.replace("$uid",uid);

         linkTitle = linkTitle.replace("$name",name);
         linkURL = linkURL.replace("$name",name);

         linkTitle = linkTitle.replace("$appSubUrl",this.ctrl.$scope.$root.appSubUrl);
         linkURL = linkURL.replace("$appSubUrl",this.ctrl.$scope.$root.appSubUrl);

         const linkTarget = this.ctrl.panel.linkTargetBlank ? '_blank' : '';

         circle.link = linkURL;
         circle.target = linkTarget;

         label += '<br><a href="' + linkURL + '" target="' + linkTarget + '">' + linkTitle + '</a>';

   }



    circle.bindPopup(label, {
      offset: (<any>window).L.point(0, -2),
      className: 'worldmap-popup',
      closeButton: this.ctrl.panel.stickyLabels,
    });

    circle.on('mouseover', function onMouseOver(evt) {
      const layer = evt.target;
      layer.bringToFront();
      this.openPopup();
    });

    if (!this.ctrl.panel.stickyLabels) {
      circle.on('mouseout', function onMouseOut() {
        circle.closePopup();
      });
    }

    circle.on('dblclick', function openLink() {
      window.open(circle.link, circle.target);
    });
    //




  }



  getColor(value) {
    for (let index = this.ctrl.data.thresholds.length; index > 0; index -= 1) {
      if (value >= this.ctrl.data.thresholds[index - 1]) {
        return this.ctrl.panel.colors[index];
      }
    }
    return _.first(this.ctrl.panel.colors);
  }

  resize() {
    this.map.invalidateSize();
  }

  panToMapCenter() {
    this.map.panTo([parseFloat(this.ctrl.panel.mapCenterLatitude), parseFloat(this.ctrl.panel.mapCenterLongitude)]);
    this.ctrl.mapCenterMoved = false;
  }

  removeLegend() {
    this.legend.remove(this.map);
    this.legend = null;
  }

  setMouseWheelZoom() {
    if (!this.ctrl.panel.mouseWheelZoom) {
      this.map.scrollWheelZoom.disable();
    } else {
      this.map.scrollWheelZoom.enable();
    }
  }

  addCircles(circles) {
    return (<any>window).L.layerGroup(circles).addTo(this.map);
  }

  removeCircles() {
    this.map.removeLayer(this.circlesLayer);
  }

  setZoom(zoomFactor) {
    this.map.setZoom(parseInt(zoomFactor, 10));
  }

  remove() {
    this.circles = [];
    if (this.circlesLayer) {
      this.removeCircles();
    }
    if (this.legend) {
      this.removeLegend();
    }
    this.map.remove();
  }
}
