#include "hardwarelib.h"

char* HL_ATTR dummy_str = "";

// This function should be called so that .hardwarelib won't be deleted by linker.
void init_hardwarelib() {
    printf("%s", dummy_str);
    return;
}

static int get_num_length(int n) {
    if (n == 0) { return 1; }
    int current_num = n;
    int digit = 0;
    while(current_num != 0){
        current_num = current_num / 10;
        digit += 1;
    }
    return n;
}

void fbody_console_log_integer(value_t self, int32_t _n) {
    printf("%ld\n", _n);
    int num_length = get_num_length(_n);
    char str[num_length + 1];
    snprintf(str, num_length, "%ld", _n);
    bluescript_log_push(str);
}
struct func_body HL_ATTR _console_log_integer = { fbody_console_log_integer, "(i)v" };


// UTILS
static void fbody_waitMs(value_t self, int32_t _ms) {
    vTaskDelay(_ms / portTICK_PERIOD_MS);
}
struct func_body HL_ATTR _waitMs = { fbody_waitMs, "(i)v" };

// PWM
#define LEDC_MODE               LEDC_LOW_SPEED_MODE
#define LEDC_DUTY_RES           LEDC_TIMER_13_BIT
#define LEDC_FREQUENCY          (5000)

typedef struct _channel_t {
    gpio_num_t pin_id;
    int timer_id;
} channel_t;

static channel_t channels[LEDC_CHANNEL_MAX];

static void fbody_initPWM(value_t self, int32_t _channelId, int32_t _timerId, int32_t _pinId) {
    if (_channelId >= LEDC_CHANNEL_MAX) {
        printf("channelId should be less than %d\n", LEDC_CHANNEL_MAX);
        return;
    }

    ledc_timer_config_t ledc_timer = {
        .speed_mode       = LEDC_MODE,
        .timer_num        = _timerId,
        .duty_resolution  = LEDC_DUTY_RES,
        .freq_hz          = LEDC_FREQUENCY,
        .clk_cfg          = LEDC_AUTO_CLK
    };
    ESP_ERROR_CHECK(ledc_timer_config(&ledc_timer));

    ledc_channel_config_t ledc_channel = {
        .speed_mode     = LEDC_MODE,
        .channel        = _channelId,
        .timer_sel      = _timerId,
        .intr_type      = LEDC_INTR_DISABLE,
        .gpio_num       = _pinId,
        .duty           = 0, 
        .hpoint         = 0
    };
    ESP_ERROR_CHECK(ledc_channel_config(&ledc_channel));

    channels[_channelId].pin_id = _pinId;
    channels[_channelId].timer_id = _timerId;
}
struct func_body HL_ATTR _initPWM = { fbody_initPWM, "(iii)v" };

static void fbody_setPWMDuty(value_t self, int32_t _channelId, float _duty) {
    if (_duty < 0 || _duty > 1) {
        printf("duty should be 0 < duty < 1\n");
        return;
    }
    uint32_t duty = ((0b01 << 13) - 1) * _duty;
    ESP_ERROR_CHECK(ledc_set_duty(LEDC_MODE, _channelId, duty));
    ESP_ERROR_CHECK(ledc_update_duty(LEDC_MODE, _channelId));
}
struct func_body HL_ATTR _setPWMDuty = { fbody_setPWMDuty, "(if)v" };

static void fbody_stopPWM(value_t self, int32_t _channelId) {
    ESP_ERROR_CHECK(ledc_stop(LEDC_MODE, _channelId, 0));
}
struct func_body HL_ATTR _stopPWM = { fbody_stopPWM, "(i)v" };

static void fbody_deinitPWM(value_t self, int32_t _channelId) {
    ESP_ERROR_CHECK(ledc_stop(LEDC_MODE, _channelId, 0));
    esp_rom_gpio_connect_out_signal(channels[_channelId].pin_id, LEDC_LS_SIG_OUT0_IDX + _channelId, false, true);
}
struct func_body HL_ATTR _deinitPWM = { fbody_deinitPWM, "(i)v" };


// LED
static led_strip_t *pStrip_a;

static void fbody_configLED(value_t self, int32_t _channelId, int32_t _pinId, int32_t _numLED) {
    pStrip_a = led_strip_init(_channelId, _pinId, _numLED);
    pStrip_a->clear(pStrip_a, 50);
}
struct func_body HL_ATTR _configLED = { fbody_configLED, "(iii)v" };

static void fbody_setLEDPixel(value_t self, int32_t _index, int32_t _red, int32_t _green, int32_t _blue) {
    pStrip_a->set_pixel(pStrip_a, _index, _red, _green, _blue);
}
struct func_body HL_ATTR _setLEDPixel = { fbody_setLEDPixel, "(iiii)v" };

static void fbody_refreshLED(value_t self) {
    pStrip_a->refresh(pStrip_a, 50);
}
struct func_body HL_ATTR _refreshLED = { fbody_refreshLED, "()v" };

static void fbody_clearLED(value_t self) {
    pStrip_a->clear(pStrip_a, 50);
}
struct func_body HL_ATTR _clearLED = { fbody_clearLED, "()v" };


// Timer
esp_timer_handle_t oneshot_timer;

static void cb_caller(void *cb) {
    interrupt_handler_start();
    ROOT_SET(func_rootset, 1)
    func_rootset.values[0] = cb;
    ((void (*)(value_t))gc_function_object_ptr(func_rootset.values[0], 0))(get_obj_property(func_rootset.values[0], 2));
    DELETE_ROOT_SET(func_rootset)
    interrupt_handler_end();
}

static void fbody_createOneShotTimer(value_t self, value_t _cb) {
    ROOT_SET(func_rootset, 1)
    func_rootset.values[0] = _cb;
    const esp_timer_create_args_t oneshot_timer_args = {
        .callback = &cb_caller,
        .arg = (void*) _cb,
        .name = "one-shot"
    };
    ESP_ERROR_CHECK(esp_timer_create(&oneshot_timer_args, &oneshot_timer));
    DELETE_ROOT_SET(func_rootset)
}
struct func_body HL_ATTR _createOneShotTimer = { fbody_createOneShotTimer, "(()v)v" };

static void fbody_startOneShotTimer(value_t self, int32_t _timerUs) {
    esp_timer_start_once(oneshot_timer, _timerUs);
}
struct func_body HL_ATTR _startOneShotTimer = { fbody_startOneShotTimer, "(i)v" };

static void fbody_deleteOneShotTimer(value_t self) {
    ESP_ERROR_CHECK(esp_timer_delete(oneshot_timer));
}
struct func_body HL_ATTR _deleteOneShotTimer = { fbody_deleteOneShotTimer, "()v" };



// Display
#define LCD_HOST    HSPI_HOST

#define PIN_NUM_MISO   19
#define PIN_NUM_MOSI   23
#define PIN_NUM_CLK    18
#define PIN_NUM_CS     14

#define PIN_NUM_DC     27
#define PIN_NUM_RST    33
#define PIN_NUM_BCKL   32

#define DISPLAY_WIDTH  320
#define DISPLAY_HEIGHT 240

#define CHAR_WIDTH     8
#define CHAR_HEIGHT    8

// To speed up transfers, every SPI transfer sends a bunch of lines. This define specifies how many. More means more memory use,
// but less overhead for setting up / finishing transfers. Make sure 240 is dividable by this.
#define PARALLEL_LINES 16
#define MAX_TRANSFER_SIZE PARALLEL_LINES*DISPLAY_WIDTH*2+8

#define MAX(a,b) (((a) > (b)) ? (a) : (b))
#define MIN(a,b) (((a) < (b)) ? (a) : (b))


// Display commands
#define COLUMN_SET           0x2a
#define PAGE_SET             0x2b
#define RAM_WRITE            0x2c
#define RAM_READ             0x2e
#define DISPLAY_ON           0x29
#define WAKE                 0x11
#define LINE_SET             0x37
#define MADCTL               0x36
#define DISPLAY_INVERSION_ON 0x21

uint8_t* get_font8x8_char(char chr);

uint16_t get_color565(uint8_t r, uint8_t g, uint8_t b) {
    uint16_t v = 0;
    v |= ((r >> 3) << 11);
    v |= ((g >> 2) << 5);
    v |= ((b >> 3) << 0);
    v = (v >> 8) | (v << 8); // big-endian
    return v;
}

typedef struct {
    uint8_t cmd;
    uint8_t data[16];
    uint8_t databytes; //No of data in data; bit 7 = delay after set; 0xFF = end of cmds.
} lcd_init_cmd_t;

spi_device_handle_t spi;

#define CHAR_VMARGIN 4
#define TEXT_HMARGIN 10
#define TEXT_VMARGIN 10

int32_t text_dx = 0;
int32_t text_dy = 0;

DRAM_ATTR static const lcd_init_cmd_t init_cmds[]={
    // {0xCF, {0x00, 0x83, 0X30}, 3},
    {0xef, {0x03, 0x80, 0x02}, 3},
    {0xcf, {0x00, 0xc1, 0x30}, 3},
    {0xed, {0x64, 0x03, 0x12, 0x81}, 4},
    {0xe8, {0x85, 0x00, 0x78}, 3},
    {0xcb, {0x39, 0x2c, 0x00, 0x34, 0x02}, 5},
    {0xf7, {0x20}, 1},
    {0xea, {0x00, 0x00}, 2},
    {0xc0, {0x23}, 1}, 
    {0xc1, {0x10}, 1}, 
    {0xc5, {0x3e, 0x28}, 2}, 
    {0xc7, {0x86}, 1},  
    {0x36, {0x48}, 1}, 
    {0x3a, {0x55}, 1},
    {0xb1, {0x00, 0x18}, 2},
    {0xb6, {0x08, 0x82, 0x27}, 3},
    {0xf2, {0x00}, 1}, 
    {0x26, {0x01}, 1}, 
    {0xe0, {0x0f, 0x31, 0x2b, 0x0c, 0x0e, 0x08, 0x4e, 0xf1, 0x37, 0x07, 0x10, 0x03, 0x0e, 0x09, 0x00}, 15},
    {0xe1, {0x00, 0x0e, 0x14, 0x03, 0x11, 0x07, 0x31, 0xc1, 0x48, 0x08, 0x0f, 0x0c, 0x31, 0x36, 0x0f}, 15},
};

void spi_pre_transfer_callback(spi_transaction_t *t) {
    int dc=(int)t->user;
    gpio_set_level(PIN_NUM_DC, dc);
}

void spi_write_cmd(const uint8_t cmd) {
    esp_err_t ret;
    spi_transaction_t t;
    memset(&t, 0, sizeof(t));       //Zero out the transaction
    t.length=8;                     //Command is 8 bits
    t.tx_buffer=&cmd;               //The data is the cmd itself
    t.user=(void*)0;                //D/C needs to be set to 0
    ret=spi_device_polling_transmit(spi, &t);  //Transmit!
    assert(ret==ESP_OK);            //Should have had no issues.
}

static void spi_write_data(const uint8_t *data, int len) {
    esp_err_t ret;
    spi_transaction_t t;
    if (len==0) return;             //no need to send anything
    memset(&t, 0, sizeof(t));       //Zero out the transaction
    t.length=len*8;                 //Len is in bytes, transaction length is in bits.
    t.tx_buffer=data;               //Data
    t.user=(void*)1;                //D/C needs to be set to 1
    ret=spi_device_polling_transmit(spi, &t);  //Transmit!
    assert(ret==ESP_OK);            //Should have had no issues.
}

static void spi_init() {
    esp_err_t ret;
    spi_bus_config_t buscfg={
        .miso_io_num=PIN_NUM_MISO,
        .mosi_io_num=PIN_NUM_MOSI,
        .sclk_io_num=PIN_NUM_CLK,
        .quadwp_io_num=-1,
        .quadhd_io_num=-1,
        .max_transfer_sz=MAX_TRANSFER_SIZE
    };
    spi_device_interface_config_t devcfg={
        .clock_speed_hz=10*1000*1000,           //Clock out at 10 MHz
        .mode=0,                                //SPI mode 0
        .spics_io_num=PIN_NUM_CS,               //CS pin
        .queue_size=7,                          //We want to be able to queue 7 transactions at a time
        .pre_cb=spi_pre_transfer_callback,
    };
    //Initialize the SPI bus
    ret=spi_bus_initialize(LCD_HOST, &buscfg, 2);
    ESP_ERROR_CHECK(ret);
    //Attach the LCD to the SPI bus
    ret=spi_bus_add_device(LCD_HOST, &devcfg, &spi);
    
    ESP_ERROR_CHECK(ret);
}

static void gpio_init() {
    //Initialize non-SPI GPIOs
    // gpio_set_direction(PIN_NUM_CS, GPIO_MODE_OUTPUT);
    gpio_set_direction(PIN_NUM_DC, GPIO_MODE_OUTPUT);
    gpio_set_direction(PIN_NUM_RST, GPIO_MODE_OUTPUT);
    gpio_set_direction(PIN_NUM_BCKL, GPIO_MODE_OUTPUT);

    // gpio_set_level(PIN_NUM_CS, 1);
    gpio_set_level(PIN_NUM_DC, 0);
    gpio_set_level(PIN_NUM_RST, 0);
    gpio_set_level(PIN_NUM_BCKL, 0);
}

static void write_block(uint16_t x0, uint16_t y0, uint16_t x1, uint16_t y1, uint16_t *data, uint32_t datalen) {
    if (datalen > MAX_TRANSFER_SIZE - 8) {
        printf("Error: The length of data should be smaller than %ld.\n", datalen);
    }

    esp_err_t ret;
    int x;
    static spi_transaction_t trans[6];
    for (x=0; x<6; x++) {
        memset(&trans[x], 0, sizeof(spi_transaction_t));
        if ((x&1)==0) {
            //Even transfers are commands
            trans[x].length=8;
            trans[x].user=(void*)0;
        } else {
            //Odd transfers are data
            trans[x].length=8*4;
            trans[x].user=(void*)1;
        }
        trans[x].flags=SPI_TRANS_USE_TXDATA;
    }

    trans[0].tx_data[0] = COLUMN_SET;     //Column Address Set
    trans[1].tx_data[0] = x0 >> 8;        //Start Col High
    trans[1].tx_data[1] = x0 & 0xff;      //Start Col Low
    trans[1].tx_data[2] = x1 >> 8;        //End Col High
    trans[1].tx_data[3] = x1 & 0xff;      //End Col Low
    trans[2].tx_data[0] = PAGE_SET;       //Page address set
    trans[3].tx_data[0] = y0 >> 8;        //Start page high
    trans[3].tx_data[1] = y0 & 0xff;      //start page low
    trans[3].tx_data[2] = y1 >> 8;        //end page high
    trans[3].tx_data[3] = y1 & 0xff;      //end page low
    trans[4].tx_data[0] = RAM_WRITE;      //memory write
    trans[5].tx_buffer  =  data;          //finally send the line data
    trans[5].length = datalen * 16;       //Data length, in bits
    trans[5].flags = 0; //undo SPI_TRANS_USE_TXDATA flag

    //Queue all transactions.
    for (x=0; x<6; x++) {
        ret=spi_device_queue_trans(spi, &trans[x], portMAX_DELAY);
        assert(ret==ESP_OK);
    }
}

static void check_write_block_finish() {
    spi_transaction_t *rtrans;
    esp_err_t ret;
    //Wait for all 6 transactions to be done and get back the results.
    for (int x = 0; x<6; x++) {
        ret=spi_device_get_trans_result(spi, &rtrans, portMAX_DELAY);
        assert(ret == ESP_OK);
        //We could inspect rtrans now if we received any info back. The LCD is treated as write-only, though.
    }
}

void display_draw(bool (*draw_func)(uint32_t, uint32_t), uint16_t color, uint16_t background) {
    uint16_t *lines[2];
    //Allocate memory for the pixel buffers
    for (int i = 0; i<2; i++) {
        lines[i] = heap_caps_malloc(320*PARALLEL_LINES*sizeof(uint16_t), MALLOC_CAP_DMA);
        assert(lines[i] != NULL);
    }
    int frame = 0;
    //Indexes of the line currently being sent to the LCD and the line we're calculating.
    int sending_line = -1;
    int calc_line = 0;

    for (uint32_t line_start = 0; line_start < 240; line_start += PARALLEL_LINES) {
        uint16_t *bmp = lines[calc_line];
        for (uint32_t y = line_start; y < line_start + PARALLEL_LINES; y++) {
            for (uint32_t x = 0; x < DISPLAY_WIDTH; x++) {
                *bmp++ = draw_func(x, y) ? color : background;
            }
        }

        //Finish up the sending process of the previous line, if any
        if (sending_line != -1) check_write_block_finish();
        //Swap sending_line and calc_line
        sending_line = calc_line;
        calc_line = (calc_line == 1) ? 0 : 1;
        //Send the line we currently calculated.
        write_block(0, line_start, DISPLAY_WIDTH, line_start + PARALLEL_LINES, lines[sending_line], DISPLAY_WIDTH * PARALLEL_LINES);
        //The line set is queued up for sending now; the actual sending happens in the
        //background. We can go on to calculate the next line set as long as we do not
        //touch line[sending_line]; the SPI sending process is still reading from that.
    }
    check_write_block_finish();
    heap_caps_free(lines[0]);
    heap_caps_free(lines[1]);
}

bool fill(uint32_t x, uint32_t y) {
    return true;
}

bool circle(uint32_t x, uint32_t y) {
    return (x - 160) * (x - 160) + (y - 120) * (y - 120) > 50 * 50;
}

bool heart(uint32_t x, uint32_t y) {
    const int32_t a = 30;
    const int32_t b = 30;
    int32_t _x = (int32_t)x - 160;
    int32_t _y = (int32_t)y - 120;
    int32_t abs_x = _x > 0 ? _x : - _x;

    if (_y > 0) 
        return b * _y <= a * (2 * a - abs_x);
    else
        return _y * (_y + 2 * b) <= abs_x * (2 * a - abs_x);
}

bool small_heart(uint32_t x, uint32_t y) {
    const int32_t a = 20;
    const int32_t b = 20;
    int32_t _x = (int32_t)x - 160;
    int32_t _y = (int32_t)y - 120;
    int32_t abs_x = _x > 0 ? _x : - _x;

    if (_y > 0) 
        return b * _y <= a * (2 * a - abs_x);
    else
        return _y * (_y + 2 * b) <= abs_x * (2 * a - abs_x);
}

bool happy_face(uint32_t x, uint32_t y) {
    int32_t face_r = 80;
    int32_t eye_x = 30;
    int32_t eye_y = 30;
    int32_t eye_r = 8;
    int32_t mouse_r = 45;
    int32_t line_width = 2;

    int32_t _x = (int32_t)x - 160;
    int32_t _y = (int32_t)y - 120;
    int32_t abs_x = _x > 0 ? _x : - _x;
    int32_t sqr_r = _x * _x + _y * _y;

    if ((face_r - line_width) * (face_r - line_width) <= sqr_r && sqr_r <= (face_r + line_width) * (face_r + line_width)) {
        return true;
    } else if (_y >= 0 && ((mouse_r - line_width) * (mouse_r - line_width) <= sqr_r) && (sqr_r <= (mouse_r + line_width) * (mouse_r + line_width))) {
        return true;
    } else if ((abs_x - eye_x) * (abs_x - eye_x) + (_y + eye_y) * (_y + eye_y) <= eye_r * eye_r) {
        return true;
    } else {
        return false;
    }
}

bool sad_face(uint32_t x, uint32_t y) {
    int32_t face_r = 80;
    int32_t eye_x = 30;
    int32_t eye_y = 30;
    int32_t eye_r = 8;
    int32_t mouse_r = 50;
    int32_t mouse_limit = 30;
    int32_t mouse_y = 60;
    int32_t line_width = 2;

    int32_t _x = (int32_t)x - 160;
    int32_t _y = (int32_t)y - 120;
    int32_t abs_x = _x > 0 ? _x : - _x;
    int32_t sqr_r = _x * _x + _y * _y;

    if ((face_r - line_width) * (face_r - line_width) <= sqr_r && sqr_r <= (face_r + line_width) * (face_r + line_width)) {
        return true;
    } else if (0 <= _y && abs_x * (mouse_r - mouse_limit) <= (mouse_y - _y) * mouse_r && (mouse_r - line_width) * (mouse_r - line_width) <= _x * _x + (_y - mouse_y) * (_y - mouse_y) && _x * _x + (_y - mouse_y) * (_y - mouse_y) <= (mouse_r + line_width) * (mouse_r + line_width)) {
        return true;
    } else if ((abs_x - eye_x) * (abs_x - eye_x) + (_y + eye_y) * (_y + eye_y) <= eye_r * eye_r) {
        return true;
    } else {
        return false;
    }
}

static void display_char(char chr, uint32_t x, uint32_t y, uint16_t color, uint16_t background) {
    uint8_t *chr_font8x8 = get_font8x8_char(chr);
    uint16_t *chr_bmp = heap_caps_malloc(CHAR_WIDTH * CHAR_HEIGHT * sizeof(uint16_t), MALLOC_CAP_DMA);
    for (int col = 0; col < CHAR_WIDTH; col++) {
        uint8_t byte = chr_font8x8[col];
        for (int row = 0; row < CHAR_HEIGHT; row++) {
            chr_bmp[row * CHAR_WIDTH + col] = byte & (1 << row) ? color : background;
        }
    }

    write_block(x, y, x + 7, y + 7, chr_bmp, 8 * 8);
    check_write_block_finish();
}

static void text_new_line() {
    text_dx = 0;
    text_dy += CHAR_HEIGHT + CHAR_VMARGIN;
}


static void display_text(char *text, uint16_t color, uint16_t background) {
    char c = text[0];
    int i = 0;
    while (c != '\0') {
        if (c == '\n') {
            text_new_line();
            c = text[++i];
            continue;
        } 
        if (TEXT_HMARGIN * 2 + text_dx + CHAR_WIDTH > DISPLAY_WIDTH) {
            text_new_line();
            continue;
        }
        if (TEXT_VMARGIN * 2 + text_dy > DISPLAY_HEIGHT) break;

        display_char(c, TEXT_HMARGIN + text_dx, TEXT_VMARGIN + text_dy, color, background);
        c = text[++i];
        text_dx += CHAR_WIDTH;
    }
    
    text_new_line();
}



int32_t _DISPLAY_HEART = 0;
int32_t _DISPLAY_SMALL_HEART = 1;
int32_t _DISPLAY_HAPPY = 2;
int32_t _DISPLAY_SAD = 3;

const uint8_t font8x8[] = {
/*   */ 0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
/* ! */ 0x00,0x00,0x00,0x00,0x4f,0x4f,0x00,0x00,
/* " */ 0x00,0x00,0x07,0x07,0x00,0x00,0x07,0x07,
/* # */ 0x00,0x14,0x7f,0x7f,0x14,0x14,0x7f,0x7f,
/* $ */ 0x00,0x00,0x24,0x2e,0x6b,0x6b,0x3a,0x12,
/* % */ 0x00,0x00,0x63,0x33,0x18,0x0c,0x66,0x63,
/* & */ 0x00,0x00,0x32,0x7f,0x4d,0x4d,0x77,0x72,

/* flipped backtick! */ 0x00,0x00,0x00,0x00,0x04,0x06,0x03,0x01,

/* ( */ 0x00,0x00,0x00,0x1c,0x3e,0x63,0x41,0x00,
/* ) */ 0x00,0x00,0x00,0x41,0x63,0x3e,0x1c,0x00,
/* * */ 0x00,0x08,0x2a,0x3e,0x1c,0x1c,0x3e,0x2a,
/* + */ 0x00,0x00,0x08,0x08,0x3e,0x3e,0x08,0x08,
/* , */ 0x00,0x00,0x00,0x80,0xe0,0x60,0x00,0x00,
/* - */ 0x00,0x00,0x08,0x08,0x08,0x08,0x08,0x08,
/* . */ 0x00,0x00,0x00,0x00,0x60,0x60,0x00,0x00,
/* / */ 0x00,0x00,0x40,0x60,0x30,0x18,0x0c,0x06,

/* 0 */ 0x00,0x00,0x3e,0x7f,0x49,0x45,0x7f,0x3e,
/* 1 */ 0x00,0x00,0x40,0x44,0x7f,0x7f,0x40,0x40,
/* 2 */ 0x00,0x00,0x62,0x73,0x51,0x49,0x4f,0x46,
/* 3 */ 0x00,0x00,0x22,0x63,0x49,0x49,0x7f,0x36,
/* 4 */ 0x00,0x00,0x18,0x18,0x14,0x16,0x7f,0x7f,
/* 5 */ 0x00,0x00,0x27,0x67,0x45,0x45,0x7d,0x39,
/* 6 */ 0x00,0x00,0x3e,0x7f,0x49,0x49,0x7b,0x32,
/* 7 */ 0x00,0x00,0x03,0x03,0x79,0x7d,0x07,0x03,
/* 8 */ 0x00,0x00,0x36,0x7f,0x49,0x49,0x7f,0x36,
/* 9 */ 0x00,0x00,0x26,0x6f,0x49,0x49,0x7f,0x3e,
/* : */ 0x00,0x00,0x00,0x00,0x24,0x24,0x00,0x00,
/* ; */ 0x00,0x00,0x00,0x80,0xe4,0x64,0x00,0x00,
/* < */ 0x00,0x00,0x08,0x1c,0x36,0x63,0x41,0x41,
/* = */ 0x00,0x00,0x14,0x14,0x14,0x14,0x14,0x14,
/* > */ 0x00,0x00,0x41,0x41,0x63,0x36,0x1c,0x08,
/* ? */ 0x00,0x00,0x02,0x03,0x51,0x59,0x0f,0x06,

/* @ */ 0x00,0x00,0x3e,0x7f,0x41,0x4d,0x4f,0x2e,

/* A */ 0x00,0x00,0x7c,0x7e,0x0b,0x0b,0x7e,0x7c,
/* B */ 0x00,0x00,0x7f,0x7f,0x49,0x49,0x7f,0x36,
/* 1 */ 0x00,0x00,0x3e,0x7f,0x41,0x41,0x63,0x22,
/* D */ 0x00,0x00,0x7f,0x7f,0x41,0x63,0x3e,0x1c,
/* E */ 0x00,0x00,0x7f,0x7f,0x49,0x49,0x41,0x41,
/* F */ 0x00,0x00,0x7f,0x7f,0x09,0x09,0x01,0x01,
/* G */ 0x00,0x00,0x3e,0x7f,0x41,0x49,0x7b,0x3a,
/* H */ 0x00,0x00,0x7f,0x7f,0x08,0x08,0x7f,0x7f,
/* I */ 0x00,0x00,0x00,0x41,0x7f,0x7f,0x41,0x00,
/* J */ 0x00,0x00,0x20,0x60,0x41,0x7f,0x3f,0x01,
/* K */ 0x00,0x00,0x7f,0x7f,0x1c,0x36,0x63,0x41,
/* L */ 0x00,0x00,0x7f,0x7f,0x40,0x40,0x40,0x40,
/* M */ 0x00,0x00,0x7f,0x7f,0x06,0x0c,0x06,0x7f,
/* N */ 0x00,0x00,0x7f,0x7f,0x0e,0x1c,0x7f,0x7f,
/* O */ 0x00,0x00,0x3e,0x7f,0x41,0x41,0x7f,0x3e,
/* P */ 0x00,0x00,0x7f,0x7f,0x09,0x09,0x0f,0x06,
/* Q */ 0x00,0x00,0x1e,0x3f,0x21,0x61,0x7f,0x5e,
/* R */ 0x00,0x00,0x7f,0x7f,0x19,0x39,0x6f,0x46,
/* S */ 0x00,0x00,0x26,0x6f,0x49,0x49,0x7b,0x32,
/* T */ 0x00,0x00,0x01,0x01,0x7f,0x7f,0x01,0x01,
/* U */ 0x00,0x00,0x3f,0x7f,0x40,0x40,0x7f,0x3f,
/* V */ 0x00,0x00,0x1f,0x3f,0x60,0x60,0x3f,0x1f,
/* W */ 0x00,0x00,0x7f,0x7f,0x30,0x18,0x30,0x7f,
/* X */ 0x00,0x00,0x63,0x77,0x1c,0x1c,0x77,0x63,
/* Y */ 0x00,0x00,0x07,0x0f,0x78,0x78,0x0f,0x07,
/* Z */ 0x00,0x00,0x61,0x71,0x59,0x4d,0x47,0x43,

/* [ */ 0x00,0x00,0x7f,0x7f,0x41,0x41,0x00,0x00,
/* flipped forward slash */ 0x06,0x0c,0x18,0x30,0x60,0x40,0x00,0x00,// 0x00,0x00,0x40,0x60,0x30,0x18,0x0c,0x06,
// /* (pound) */ 0x00,0x22,0x49,0x49,0x5e,0x7c,0x68,0x40, /* pound in stead of backslash */
/* ] */ 0x00,0x00,0x41,0x41,0x7f,0x7f,0x00,0x00,

/* 0x00,0x00,0x7E,0x42,0x42,0x00,0x00,0x00,  // [
    0x00,0x04,0x08,0x10,0x20,0x40,0x00,0x00,  // <backslash>
    0x00,0x00,0x42,0x42,0x7E,0x00,0x00,0x00,  // ] */

    0x00,0x08,0x04,0x7E,0x04,0x08,0x00,0x00,  // ^
    0x80,0x80,0x80,0x80,0x80,0x80,0x80,0x00,  // _

/* backslash */ 0x00,0x01,0x03,0x06,0x04,0x00,0x00,0x00,
/* a */ 0x00,0x00,0x20,0x74,0x54,0x54,0x7c,0x78,
/* b */ 0x00,0x00,0x7e,0x7e,0x48,0x48,0x78,0x30,
/* c */ 0x00,0x00,0x38,0x7c,0x44,0x44,0x44,0x00,
/* d */ 0x00,0x00,0x30,0x78,0x48,0x48,0x7e,0x7e,
/* e */ 0x00,0x00,0x38,0x7c,0x54,0x54,0x5c,0x18,
/* f */ 0x00,0x00,0x00,0x08,0x7c,0x7e,0x0a,0x0a,
/* g */ 0x00,0x00,0x98,0xbc,0xa4,0xa4,0xfc,0x7c,
/* h */ 0x00,0x00,0x7e,0x7e,0x08,0x08,0x78,0x70,
/* i */ 0x00,0x00,0x00,0x48,0x7a,0x7a,0x40,0x00,
/* j */ 0x00,0x00,0x00,0x80,0x80,0x80,0xfa,0x7a,
/* k */ 0x00,0x00,0x7e,0x7e,0x10,0x38,0x68,0x40,
/* l */ 0x00,0x00,0x00,0x42,0x7e,0x7e,0x40,0x00,
/* m */ 0x00,0x00,0x7c,0x7c,0x18,0x38,0x1c,0x7c,
/* n */ 0x00,0x00,0x7c,0x7c,0x04,0x04,0x7c,0x78,
/* o */ 0x00,0x00,0x38,0x7c,0x44,0x44,0x7c,0x38,
/* p */ 0x00,0x00,0xfc,0xfc,0x24,0x24,0x3c,0x18,
/* q */ 0x00,0x00,0x18,0x3c,0x24,0x24,0xfc,0xfc,
/* r */ 0x00,0x00,0x7c,0x7c,0x04,0x04,0x0c,0x08,
/* s */ 0x00,0x00,0x48,0x5c,0x54,0x54,0x74,0x24,
/* t */ 0x00,0x00,0x04,0x04,0x3e,0x7e,0x44,0x44,
/* u */ 0x00,0x00,0x3c,0x7c,0x40,0x40,0x7c,0x7c,
/* v */ 0x00,0x00,0x1c,0x3c,0x60,0x60,0x3c,0x1c,
/* w */ 0x00,0x00,0x1c,0x7c,0x70,0x38,0x70,0x7c,
/* x */ 0x00,0x00,0x44,0x6c,0x38,0x38,0x6c,0x44,
/* y */ 0x00,0x00,0x9c,0xbc,0xa0,0xe0,0x7c,0x3c,
/* z */ 0x00,0x00,0x44,0x64,0x74,0x5c,0x4c,0x44,
    0x00,0x08,0x08,0x76,0x42,0x42,0x00,0x00,  // {
    0x00,0x00,0x00,0x7E,0x00,0x00,0x00,0x00,  // |
    0x00,0x42,0x42,0x76,0x08,0x08,0x00,0x00,  // }
    0x00,0x00,0x04,0x02,0x04,0x02,0x00,0x00,  // ~
    
    0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,  // BLOCK = 127
/* (spades) */ 0x18,0x5c,0x7e,0x7f,0x7e,0x5c,0x18,0x00, // 128
/* (heart) */ 0x0e,0x1f,0x3f,0x7e,0x3f,0x1f,0x0e,0x00,  // 129
/* (clubs) */ 0x00,0x0c,0x4c,0x73,0x73,0x4c,0x0c,0x00,  // 130
/* (diamonds) */ 0x08,0x1c,0x3e,0x7f,0x3e,0x1c,0x08,0x00, // 131

/* progress bar outline */
0x18, 0x24, 0x24, 0x24, 0x24, 0x24, 0x24, 0x24, // |=  // 132
0x24, 0x24, 0x24, 0x24, 0x24, 0x24, 0x24, 0x24, // = 133
0x24, 0x24, 0x24, 0x24, 0x24, 0x24, 0x24, 0x18, // =| 134

/* progress bar filled */
0x18, 0x3c, 0x3c, 0x3c, 0x3c, 0x3c, 0x3c, 0x3c, // 135
0x3c, 0x3c, 0x3c, 0x3c, 0x3c, 0x3c, 0x3c, 0x3c, // 136
0x3c, 0x3c, 0x3c, 0x3c, 0x3c, 0x3c, 0x3c, 0x18, // 137

/* arrows (navi) */
0x04, 0x0E, 0x1F, 0x04, 0x04, 0x04, 0xF8, 0x00, // 138 arrow right [correct orientation]
0x00, 0xF8, 0x04, 0x04, 0x04, 0x1F, 0x0E, 0x04, // 139 arrow right [correct orientation]
0x00, 0x04, 0x06, 0xFF, 0x06, 0x04, 0x00, 0x00, // 140 arrow up

6,   14,   31, 0xFB,   31,   14,    6,    0x00, // 141 GPS pin...
0x00, 0x06, 0x0f, 0x09, 0x0f, 0x06, 0x00, 0x00, // 142 angle / degrees sign

0x00, 0x20, 0x60, 0xFF, 0x60, 0x20, 0x00, 0x00  // 143 arrow DOWN
};

uint8_t* get_font8x8_char(char chr) {
    uint32_t idx = chr - ' ';
    return font8x8 + idx * 8;
}

void fbody_displayReset(value_t self) {
    gpio_set_level(PIN_NUM_BCKL, 0);
    gpio_set_level(PIN_NUM_RST, 0);
    vTaskDelay(50 / portTICK_PERIOD_MS);
    gpio_set_level(PIN_NUM_RST, 1);
    vTaskDelay(50 / portTICK_PERIOD_MS);
}
struct func_body HL_ATTR _displayReset = { fbody_displayReset, "()v" };

void fbody_displayInit(value_t self) {
    spi_init();
    gpio_init();
    fbody_displayReset(0);
    int cmd = 0;
    //Send all the commands
    while (init_cmds[cmd].databytes!=0xff) {
        spi_write_cmd(init_cmds[cmd].cmd);
        spi_write_data(init_cmds[cmd].data, init_cmds[cmd].databytes&0x1F);
        if (init_cmds[cmd].databytes&0x80) {
            vTaskDelay(100 / portTICK_PERIOD_MS);
        }
        cmd++;
    }

    spi_write_cmd(MADCTL);
    uint8_t data[16] = {0x08};
    spi_write_data(data, 1&0x1F);
    spi_write_cmd(DISPLAY_INVERSION_ON);
    spi_write_cmd(WAKE);
    vTaskDelay(120 / portTICK_PERIOD_MS);
    spi_write_cmd(DISPLAY_ON);
    gpio_set_level(PIN_NUM_BCKL, 1);
}
struct func_body HL_ATTR _displayInit = { fbody_displayInit, "()v" };

void fbody_displayFill(value_t self, int32_t _color) {
    display_draw(fill, _color, _color);
}
struct func_body HL_ATTR _displayFill = { fbody_displayFill, "(i)v" };

void fbody_displayShowIcon(value_t self, int32_t _icon, int32_t _color, int32_t _background) {
    if (_icon == _DISPLAY_HEART) {
        display_draw(heart, _color, _background);
    }
    else if (_icon == _DISPLAY_SMALL_HEART) {
        display_draw(small_heart, _color, _background);
    }
    else if (_icon == _DISPLAY_HAPPY) {
        display_draw(happy_face, _color, _background);
    }
    else 
    if (_icon == _DISPLAY_SAD) {
        display_draw(sad_face, _color, _background);
    }
}
struct func_body HL_ATTR _displayShowIcon = { fbody_displayShowIcon, "(iii)v" };

void fbody_displayShowString(value_t self, value_t _str, int32_t _color, int32_t _background) {
    ROOT_SET(func_rootset, 1)
    func_rootset.values[0] = _str;
    char* text = gc_string_literal_cstr(_str);
    display_text(text, (uint16_t)_color, (uint16_t)_background);
    DELETE_ROOT_SET(func_rootset)
}
struct func_body HL_ATTR _displayShowString = { fbody_displayShowString, "(sii)v" };

static void fbody_displayShowInt(value_t self, int32_t _num, int32_t _color, int32_t _background) {
    char buff[12]; // Max num length + blank
    sprintf(buff, "%ld", _num);
    display_text(&buff, (uint16_t)_color, (uint16_t)_background);
}
struct func_body HL_ATTR _displayShowInt = { fbody_displayShowInt, "(iii)v" };

int32_t fbody_getColor(value_t self, int32_t _r, int32_t _g, int32_t _b) {
    int32_t _color = 0;
    _color |= ((_r >> 3) << 11);
    _color |= ((_g >> 2) << 5);
    _color |= ((_b >> 3) << 0);
    _color = (_color >> 8) | (_color << 8); // big-endian
    { int32_t ret_value_ = (_color); ; return ret_value_; }
}
struct func_body HL_ATTR _getColor = { fbody_getColor, "(iii)i" };


// Button
typedef struct {
    int32_t button_pin;
    value_t callback;
} button_callback_t;
     
static button_callback_t button_callback_table[GPIO_NUM_MAX];
     
static bool isr_was_installed = false;
static QueueHandle_t button_callback_queue = NULL;
     
static void button_isr_handler(void *arg) {
    int32_t button_pin = (int32_t) arg;
    xQueueSendFromISR(button_callback_queue, &button_pin, NULL);
}
     
static void button_callback_executor() {
    int32_t button_pin;
    while (true) {
        if(xQueueReceive(button_callback_queue, &button_pin, portMAX_DELAY)) {
            value_t callback = button_callback_table[button_pin].callback;
            if (callback != NULL) {
                puts("button callback executor");
                ((void (*)(value_t))gc_function_object_ptr(callback, 0))(get_obj_property(callback, 2));
            }
        }
    }
}

void fbody_buttonOnPressed(value_t self, int32_t _buttonPin, value_t _callback) {
    ROOT_SET(func_rootset, 1)
    func_rootset.values[0] = _callback;
    gpio_set_direction(_buttonPin, GPIO_MODE_INPUT);
    gpio_set_intr_type(_buttonPin, GPIO_INTR_POSEDGE);
    if (!isr_was_installed) {
        gpio_install_isr_service(0);
        button_callback_queue = xQueueCreate(10, sizeof(int32_t));
        xTaskCreate(button_callback_executor, "button_callback_executor", 2048, NULL, 10, NULL);
        isr_was_installed = true;
    }
    gpio_isr_handler_add(_buttonPin, button_isr_handler, (void*)_buttonPin);
    button_callback_table[_buttonPin].button_pin = _buttonPin;
    button_callback_table[_buttonPin].callback = _callback;
    DELETE_ROOT_SET(func_rootset)
}
struct func_body HL_ATTR _buttonOnPressed = { fbody_buttonOnPressed, "(i()v)v" };

int32_t fbody_randInt(value_t self, int32_t _min, int32_t _max) {
    int32_t _ri = 0;
    _ri = rand() % (_max - _min + 1) + _min;
    { int32_t ret_value_ = (_ri); ; return ret_value_; }
}
struct func_body HL_ATTR _randInt = { fbody_randInt, "(ii)i" };
