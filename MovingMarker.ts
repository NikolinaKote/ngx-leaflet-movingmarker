import { Marker, MarkerOptions, Map, LatLng, latLng, Util } from 'leaflet';

enum MovingMarkerState {
  NOT_STARTED = 0,
  ENDED = 1,
  PAUSED = 2,
  RUN = 3,
}

export interface MovingMarkerOptions extends MarkerOptions {
  autostart: boolean;
  loop: boolean;
}

export class MovingMarker extends Marker {
  private latLngs: LatLng[];
  private durations: number[];
  private currentDuration = 0;
  private currentIndex = 0;
  private state: MovingMarkerState = MovingMarkerState.NOT_STARTED;
  private startTime = 0;
  private startTimeStamp = 0; // timestamp given by requestAnimFrame
  private pauseStartTime = 0;
  private animId = 0;
  private animRequested = false;
  private currentLine = [];
  private stations = {};
  public options: MovingMarkerOptions;

  constructor(latLngs: LatLng[], durations: number[], options: MarkerOptions) {
    super(latLngs[0], options);
    this.latLngs = latLngs.map(e => {
      return latLng(e);
    });

    if (durations instanceof Array) {
      this.durations = durations;
    } else {
      this.durations = this.createDurations(this.latLngs, durations);
    }
  }

  private interpolatePosition(p1, p2, duration, t) {
    let k = t / duration;
    k = k > 0 ? k : 0;
    k = k > 1 ? 1 : k;
    return latLng(p1.lat + k * (p2.lat - p1.lat), p1.lng + k * (p2.lng - p1.lng));
  }

  public isRunning(): boolean {
    return this.state === MovingMarkerState.RUN;
  }

  public isEnded(): boolean {
    return this.state === MovingMarkerState.ENDED;
  }

  public isStarted(): boolean {
    return this.state !== MovingMarkerState.NOT_STARTED;
  }

  public isPaused(): boolean {
    return this.state === MovingMarkerState.PAUSED;
  }
  public start(): void {
    if (this.isRunning()) {
      return;
    }

    if (this.isPaused()) {
      this.resume();
    } else {
      this.loadLine(0);
      this.startAnimation();
      this.fire('start');
    }
  }

  public resume(): void {
    if (!this.isPaused()) {
      return;
    }
    // update the current line
    this.currentLine[0] = this.getLatLng();
    this.currentDuration -= this.pauseStartTime - this.startTime;
    this.startAnimation();
  }

  public pause(): void {
    if (!this.isRunning()) {
      return;
    }

    this.pauseStartTime = Date.now();
    this.state = MovingMarkerState.PAUSED;
    this.stopAnimation();
    this.updatePosition();
  }

  public stop(elapsedTime: number): void {
    if (this.isEnded()) {
      return;
    }

    this.stopAnimation();

    if (typeof elapsedTime === 'undefined') {
      // user call
      elapsedTime = 0;
      this.updatePosition();
    }

    this.state = MovingMarkerState.ENDED;
    this.fire('end', { elapsedTime });
  }

  public addLatLng(latlng: L.LatLng, duration: number): void {
    this.latLngs = [...this.latLngs, latLng(latlng)];
    this.durations = [...this.durations, duration];
  }

  public moveTo(latlng: L.LatLng, duration: number): void {
    this.stopAnimation();
    this.latLngs = [this.getLatLng(), latLng(latlng)];
    this.durations = [duration];
    this.state = MovingMarkerState.NOT_STARTED;
    this.start();
    this.options.loop = false;
  }

  public addStation(pointIndex: number, duration: number): void {
    if (pointIndex > this.latLngs.length - 2 || pointIndex < 1) {
      return;
    }
    this.stations[pointIndex] = duration;
  }

  public onAdd(map: Map): this {
    super.onAdd(map);
    console.log('options', this.options);
    if (this.options.autostart && !this.isStarted()) {
      this.start();
      return;
    }

    if (this.isRunning()) {
      this.resumeAnimation();
    }
  }

  public onRemove(map: Map): any {
    // L.Marker.prototype.onRemove.call(this, map);
    super.onRemove(map);
    this.stopAnimation();
  }

  private createDurations(latlngs: L.LatLng[], duration: number) {
    const lastIndex = latlngs.length - 1;
    const distances = [];
    let totalDistance = 0;
    let distance = 0;

    // compute array of distances between points
    for (let i = 0; i < lastIndex; i++) {
      distance = latlngs[i + 1].distanceTo(latlngs[i]);
      distances.push(distance);
      totalDistance += distance;
    }

    const ratioDuration = duration / totalDistance;

    let durations = [];
    distances.map(dist => (durations = [...durations, dist * ratioDuration]));

    return durations;
  }

  private startAnimation(): void {
    this.state = MovingMarkerState.RUN;
    this.animId = Util.requestAnimFrame(
      timestamp => {
        this.startTime = Date.now();
        this.startTimeStamp = timestamp;
        this.animate(timestamp);
      },
      this,
      true
    );
    this.animRequested = true;
  }

  private resumeAnimation(): void {
    if (!this.animRequested) {
      this.animRequested = true;
      this.animId = Util.requestAnimFrame(
        timestamp => {
          this.animate(timestamp);
        },
        this,
        true
      );
    }
  }

  private stopAnimation(): void {
    if (this.animRequested) {
      Util.cancelAnimFrame(this.animId);
      this.animRequested = false;
    }
  }

  private updatePosition() {
    const elapsedTime = Date.now() - this.startTime;
    this.animate(this.startTimeStamp + elapsedTime, true);
  }

  private loadLine(index: number): void {
    this.currentIndex = index;
    this.currentDuration = this.durations[index];
    this.currentLine = this.latLngs.slice(index, index + 2);
  }

  /**
   * Load the line where the marker is
   * @params timestamp
   * @return elapsed time on the current line or null if
   * we reached the end or marker is at a station
   */
  private updateLine(timestamp: number): number {
    // time elapsed since the last latlng
    let elapsedTime = timestamp - this.startTimeStamp;
    // not enough time to update the line
    if (elapsedTime <= this.currentDuration) {
      return elapsedTime;
    }

    let lineIndex = this.currentIndex;
    let lineDuration = this.currentDuration;
    let stationDuration;

    while (elapsedTime > lineDuration) {
      // substract time of the current line
      elapsedTime -= lineDuration;
      stationDuration = this.stations[lineIndex + 1];

      // test if there is a station at the end of the line
      if (stationDuration !== undefined) {
        if (elapsedTime < stationDuration) {
          this.setLatLng(this.latLngs[lineIndex + 1]);
          return null;
        }
        elapsedTime -= stationDuration;
      }

      lineIndex++;

      // test if we have reached the end of the polyline
      if (lineIndex >= this.latLngs.length - 1) {
        if (this.options.loop) {
          lineIndex = 0;
          this.fire('loop', { elapsedTime });
        } else {
          // place the marker at the end, else it would be at
          // the last position
          this.setLatLng(this.latLngs[this.latLngs.length - 1]);
          this.stop(elapsedTime);
          return null;
        }
      }
      lineDuration = this.durations[lineIndex];
    }

    this.loadLine(lineIndex);
    this.startTimeStamp = timestamp - elapsedTime;
    this.startTime = Date.now() - elapsedTime;
    return elapsedTime;
  }

  private animate(timestamp: number, noRequestAnim: boolean = false) {
    this.animRequested = false;

    // find the next line and compute the new elapsedTime
    const elapsedTime = this.updateLine(timestamp);
    console.log('ELAPSED TIME', elapsedTime);
    if (this.isEnded()) {
      // no need to animate
      return;
    }

    if (elapsedTime != null) {
      // compute the position
      const p = this.interpolatePosition(
        this.currentLine[0],
        this.currentLine[1],
        this.currentDuration,
        elapsedTime
      );
      this.setLatLng(p);
    }

    if (!noRequestAnim) {
      this.animId = Util.requestAnimFrame(this.animate, this, false);
      this.animRequested = true;
    }
  }
}
