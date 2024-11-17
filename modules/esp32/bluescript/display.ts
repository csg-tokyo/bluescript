import type { integer, code } from "../../base";

class Display {
    ICON_HEART: integer;
    ICON_SMALL_HEART: integer;
    ICON_HAPPY_FACE: integer;
    ICON_SAD_FACE: integer;

    constructor() {
        this.ICON_HEART = 0;
        this.ICON_SMALL_HEART = 1;
        this.ICON_HAPPY_FACE = 2;
        this.ICON_SAD_FACE = 3;
        this.reset();
    }

    public reset() {

    }

    public fill(color: integer) {

    }

    public showIcon(icon: integer, color: integer, background: integer) {

    }

    public showString(str: string, color: integer, background: integer) {

    }

    public showInt(int: integer, color: integer, background: integer) {

    }
    
    public color(r: integer, g: integer, b: integer):integer {
        return 2;
    }
}