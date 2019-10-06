# ngx-leaflet-movingmarker
Moving markers for [ngx-leaflet], based on the awesome work of [@ewoken].

### Table of Contents
- ### [Install](#install)
- ### [Usage](#usage)
- ### [Api](#api)
- ### [ToDo](#todo)
- ### [License](#license)
- ### [Credits](#credits)

## Install
npm usage

## Usage
```ts
import { MovingMarker, MovingMarkerOptions } from 'ngx-leaflet-movingmarker';

const options: MovingMarkerOptions = {
    icon: L.icon({
        iconSize: fromConfig.ICON_SIZE,
        iconAnchor: fromConfig.ICON_ANCHOR,
        iconUrl: fromConfig.CENTRAL_MARKER,
    }),
    autostart: true,
    loop: false,
};

map.addLayer(new MovingMarker([
        new L.LatLng(10, 10), // start location
        new L.LatLng(20, 20) // end location
    ],
    [5000], // deslocation time
    options
);
```

## Api
Please see [@ewoken]

## TODO
Specs

## License
MIT License

## Credits
I just addapted the existing javascript libary to be used in angular with typescript.
All credits goes to [@ewoken]. 

[ngx-leaflet]: <https://github.com/Asymmetrik/ngx-leaflet>
[@ewoken]: <https://github.com/ewoken/Leaflet.MovingMarker>
