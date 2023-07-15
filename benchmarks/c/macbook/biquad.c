#include <stdint.h>
#include <stdbool.h>
#include <assert.h>
#include <stdio.h>
#include <math.h>
#include "sample_data.c"

#define WARMUP 1
#define CYCLE 3
#define TAG "biquad"

#define DATA_LEN 1024
float ANSWER[DATA_LEN] = {21.738296, 75.103552, 143.779197, 232.429966, 297.877623, 309.921251, 332.107591, 386.759634, 426.017222, 416.405974, 359.479463, 267.197174, 167.947455, 121.803872, 175.862001, 268.644209, 322.323645, 361.348913, 398.786657, 388.763265, 307.402721, 220.967794, 215.195743, 290.531489, 372.657342, 408.063438, 413.392275, 375.029003, 298.917913, 242.605605, 196.26763, 134.302633, 75.596477, 39.014011, 26.097723, 62.755053, 140.556135, 213.241368, 263.422992, 277.465508, 299.69271, 360.604001, 396.242077, 375.356604, 341.849649, 301.032551, 232.732719, 180.069964, 193.535665, 242.763533, 254.450693, 252.355999, 299.211735, 351.808409, 332.349836, 263.921992, 224.989774, 213.964415, 190.323198, 176.13801, 201.766114, 247.109245, 276.497131, 278.347244, 261.291038, 219.118111, 177.909575, 196.518461, 257.351639, 313.907475, 350.957372, 349.288278, 326.506035, 321.776342, 340.98848, 353.94874, 352.213582, 348.048581, 331.886568, 319.978244, 300.260739, 231.961437, 158.105711, 150.93989, 202.593938, 263.799739, 305.961505, 308.781989, 261.056473, 174.923958, 100.399078, 101.017753, 185.937975, 299.252144, 393.499712, 459.357426, 486.313642, 457.742908, 361.76475, 251.939298, 211.406922, 211.293082, 216.450774, 267.549986, 341.012266, 369.607786, 352.582979, 327.747137, 323.275776, 350.754628, 362.328392, 304.207172, 231.080487, 195.946894, 164.1508, 136.739515, 161.068283, 212.163038, 239.138711, 275.612657, 350.296611, 414.582364, 412.008775, 349.272477, 272.541521, 229.707031, 235.311104, 243.797899, 222.791236, 182.05285, 160.02676, 195.652475, 287.924748, 390.852599, 426.209864, 380.774426, 336.237446, 310.574632, 280.732087, 253.1341, 220.944852, 202.258156, 201.851465, 225.345267, 277.95428, 328.700167, 349.802828, 329.140648, 310.826881, 322.684756, 333.22684, 330.418349, 306.079222, 270.669782, 249.351221, 247.093326, 265.582921, 286.44583, 305.142488, 309.997274, 286.506871, 263.844114, 277.677859, 339.396865, 397.127572, 377.564694, 293.510758, 208.754945, 175.135109, 211.398264, 270.015503, 297.187841, 290.610121, 290.087661, 297.149447, 278.814896, 268.218175, 298.293869, 322.011357, 293.684951, 229.293084, 189.140149, 217.227633, 297.747592, 389.299402, 451.117771, 441.965748, 358.386234, 278.53869, 261.746307, 261.314138, 229.793253, 178.076493, 125.845305, 113.188139, 170.609905, 243.611823, 291.664995, 321.913871, 323.837754, 303.54781, 268.080594, 225.915226, 202.221125, 206.233023, 226.560498, 232.336845, 211.806347, 200.751789, 203.368087, 198.709254, 201.451976, 209.64566, 212.682976, 222.164821, 232.840512, 223.720741, 191.416344, 179.79709, 221.136647, 258.069737, 230.126261, 167.728248, 124.623452, 134.285556, 192.423132, 230.656331, 216.909887, 180.283049, 145.949183, 141.249716, 196.158275, 282.936961, 327.058058, 290.129081, 200.354012, 120.618367, 85.926026, 78.281274, 87.336458, 128.378499, 189.675947, 258.529793, 303.4062, 306.875733, 324.647352, 381.313925, 414.2341, 354.501949, 225.186983, 103.214039, 38.074476, 34.921715, 75.095694, 132.766703, 201.367517, 285.670875, 362.383598, 391.521555, 368.164998, 347.967749, 325.936552, 255.935255, 176.453578, 165.085318, 221.05998, 253.625873, 249.046724, 266.803617, 291.666526, 306.879376, 316.460542, 317.12514, 347.794451, 398.478138, 422.907644, 403.74223, 355.336654, 306.215743, 260.574151, 249.187188, 286.512465, 352.731059, 418.025349, 417.365856, 329.815601, 221.48584, 166.006672, 165.74358, 169.985717, 180.035692, 227.417961, 281.503109, 303.921674, 285.145498, 252.446049, 272.735704, 335.945988, 357.903576, 318.497141, 261.837516, 222.326505, 199.7123, 177.444922, 164.161733, 172.396608, 202.002603, 264.838097, 335.191917, 367.617455, 343.908589, 261.974025, 179.274959, 144.214401, 135.346291, 167.190991, 256.757503, 360.903921, 423.380023, 405.955904, 325.953689, 238.433155, 171.694322, 123.463091, 108.138461, 133.067122, 191.168651, 253.39489, 258.56465, 222.502831, 192.198455, 150.498405, 105.051844, 103.187622, 131.21121, 166.955168, 229.047231, 275.922231, 278.28211, 262.634039, 252.726514, 276.485731, 301.131326, 287.72637, 257.513577, 236.409128, 229.996315, 214.453334, 208.512646, 254.153192, 311.13727, 321.946776, 290.879437, 237.56184, 173.084828, 135.673881, 158.509678, 226.20574, 275.708411, 278.61335, 277.128232, 301.294998, 349.304484, 401.230325, 436.156377, 442.291762, 436.9338, 422.759843, 373.526849, 331.595769, 335.382491, 331.265878, 289.936639, 265.412049, 290.460779, 335.326941, 351.899324, 311.16788, 240.716141, 186.267689, 148.216458, 106.862851, 76.232279, 80.330085, 135.174405, 243.094367, 345.581448, 394.06253, 389.238909, 356.908307, 324.822974, 266.483048, 191.996882, 143.699412, 112.209615, 118.863703, 165.949087, 197.873808, 233.204206, 306.772124, 361.083242, 331.41258, 254.197624, 213.816796, 242.428882, 317.064936, 398.909779, 449.261633, 450.108706, 420.198983, 362.817251, 279.138969, 203.273674, 154.226741, 133.659511, 163.584521, 231.429771, 281.534445, 305.579691, 339.40542, 398.731001, 450.016261, 447.024428, 391.970497, 326.026754, 266.149572, 214.882663, 201.379054, 207.709906, 180.630098, 139.344618, 136.609374, 187.771443, 257.685999, 308.150565, 322.472192, 310.779172, 305.001952, 313.044324, 350.848628, 410.078012, 434.001331, 393.989312, 305.986343, 209.997666, 134.338027, 94.170425, 127.43661, 231.894732, 331.990647, 379.21207, 403.472773, 438.506697, 467.173478, 448.994717, 359.842164, 255.895902, 219.14933, 228.494975, 219.297505, 203.48915, 240.150093, 337.464091, 450.098595, 500.079034, 443.038546, 330.628377, 225.152782, 161.262965, 147.496571, 175.620097, 224.807291, 242.407755, 224.40491, 224.497832, 259.350376, 290.506795, 267.130645, 215.500695, 183.686391, 145.737916, 102.950637, 106.014065, 155.409265, 214.872295, 280.8405, 323.268123, 307.637394, 272.870852, 240.146205, 210.89742, 204.080464, 203.901156, 217.552216, 251.857703, 263.823868, 274.505756, 296.88344, 287.144332, 255.137057, 213.920671, 180.163367, 209.313545, 307.506389, 395.50805, 386.437211, 311.67807, 266.934647, 256.064257, 239.278963, 214.383133, 204.62849, 213.1567, 230.414093, 261.145313, 269.371194, 227.502815, 195.727108, 230.249894, 289.175211, 312.128985, 305.820011, 297.939347, 281.689632, 239.171253, 194.234474, 182.823189, 208.784934, 263.027948, 300.348407, 270.76651, 210.709765, 169.046782, 128.775978, 116.544485, 177.174576, 254.273606, 273.171318, 245.684079, 230.035199, 250.695563, 300.145646, 358.483957, 378.428421, 327.897459, 254.299523, 210.467601, 193.280394, 187.139231, 176.779866, 167.494032, 174.705209, 168.63884, 162.512345, 189.737687, 216.019636, 225.459761, 232.442542, 270.613793, 342.146126, 392.996087, 400.56985, 364.678175, 307.886857, 296.917097, 344.974276, 379.004934, 364.869559, 342.743674, 316.124602, 258.734023, 194.511168, 187.884688, 230.513445, 263.477901, 305.396717, 372.355519, 400.843091, 334.235377, 226.350606, 188.084314, 223.701347, 236.444173, 216.281501, 241.077549, 299.590719, 323.687708, 305.387324, 280.141915, 287.437676, 322.080006, 329.367256, 280.382551, 203.566371, 153.914112, 163.098161, 199.775276, 225.872007, 268.480169, 343.063688, 399.11605, 398.519155, 346.397393, 276.942476, 239.794299, 261.867084, 299.269627, 297.025517, 282.85218, 277.301339, 260.957882, 248.309555, 248.551936, 239.096787, 219.20701, 211.553614, 237.749001, 278.650242, 308.99686, 326.529128, 322.530911, 309.550045, 298.037958, 299.770266, 319.008772, 338.630656, 353.77996, 347.100965, 306.045696, 256.446206, 203.656131, 131.863419, 62.167176, 38.149565, 66.936268, 107.949124, 132.41964, 134.609149, 115.58333, 100.27546, 137.372248, 213.854548, 279.414569, 322.516402, 339.686278, 357.6287, 358.478117, 308.969589, 272.617302, 277.977182, 269.609878, 230.19893, 179.768872, 137.578035, 149.150857, 205.212207, 244.883885, 270.088257, 275.514115, 261.40431, 277.769721, 311.012543, 336.987957, 375.60633, 393.539134, 345.541934, 287.317477, 284.49397, 309.722771, 333.609581, 363.993115, 394.982236, 406.99852, 374.172224, 299.748981, 240.145592, 214.793453, 197.052326, 202.030597, 234.915841, 263.167502, 260.874885, 242.114319, 263.38165, 327.506751, 375.303909, 358.190622, 285.794381, 221.420226, 195.342931, 199.450062, 239.127316, 311.09744, 358.02351, 329.034078, 261.461414, 214.201847, 186.584055, 147.531525, 115.830126, 154.304066, 253.831396, 349.362145, 427.045752, 457.45904, 400.417933, 295.829115, 223.300944, 244.104911, 339.690255, 411.05579, 399.899609, 351.286974, 309.436833, 278.554036, 272.928305, 278.93853, 282.384192, 294.996308, 302.064619, 304.814301, 295.827102, 273.091453, 265.114697, 251.996985, 227.569624, 226.395767, 271.738569, 328.605068, 358.312196, 367.918894, 327.701425, 224.564114, 144.511351, 171.298288, 271.966158, 358.640303, 376.86538, 346.643783, 323.023731, 312.517879, 299.258908, 275.083045, 253.831872, 267.583466, 302.724268, 318.853619, 309.215345, 283.600151, 277.296668, 323.061292, 384.841378, 422.525588, 422.606887, 361.840282, 280.570046, 257.641386, 273.319783, 248.792072, 171.799359, 87.793337, 66.014306, 148.568815, 286.221574, 385.856138, 399.787568, 363.312165, 305.653507, 255.359969, 253.763404, 275.722409, 277.079259, 252.353175, 237.353075, 230.978087, 199.298553, 166.969924, 154.46184, 154.400004, 179.713454, 222.509241, 239.521598, 215.06818, 188.057307, 185.078676, 218.943323, 303.220247, 403.457787, 472.659477, 471.332561, 400.490863, 343.885004, 346.666627, 350.888228, 298.954946, 210.921444, 142.345224, 136.207536, 211.495249, 319.783061, 396.182359, 417.393076, 368.427051, 271.024627, 209.899369, 221.206871, 260.929554, 317.919919, 395.594956, 431.955911, 378.707642, 303.542619, 281.130897, 293.171933, 319.031983, 346.862084, 328.993942, 275.118611, 228.604846, 189.208506, 174.053436, 194.214053, 231.50388, 265.705239, 295.264987, 310.550658, 293.223964, 267.499091, 237.803654, 195.666842, 161.559664, 144.441899, 127.526977, 114.922783, 143.934807, 195.344255, 203.338282, 160.685187, 123.135824, 133.095342, 161.598581, 185.301587, 213.985683, 241.680543, 263.19862, 251.668564, 226.935186, 218.006608, 182.098495, 132.864269, 145.63438, 219.730598, 296.217112, 331.753182, 304.620491, 254.947249, 213.983934, 167.493492, 120.445235, 102.690232, 128.53563, 158.485844, 159.144303, 163.616072, 225.971287, 325.308212, 393.287655, 405.045745, 364.56266, 287.052329, 234.907288, 253.729436, 285.73072, 269.30312, 226.377406, 201.655906, 194.642848, 185.083371, 207.738974, 279.844714, 343.052456, 361.641389, 330.241657, 253.69816, 189.078113, 202.403573, 274.800853, 348.542404, 390.93475, 389.106611, 380.82276, 375.428169, 332.423695, 256.678079, 186.85355, 148.965338, 164.60215, 245.294514, 334.970814, 379.434413, 396.094869, 408.055568, 423.123693, 410.686303, 335.499837, 250.328059, 198.654973, 183.690629, 206.663943, 221.185851, 227.443356, 269.074707, 342.790972, 393.849024, 363.678888, 266.35233, 188.082946, 201.711089, 290.504019, 370.937482, 393.551166, 396.65903, 408.832231, 401.890077, 354.513514, 283.348144, 231.15766, 224.722092, 263.720694, 305.211314, 312.171189, 310.926123, 321.914373, 330.30522, 316.39542, 275.539735, 221.726144, 205.923223, 235.680303, 267.23541, 279.666645, 259.585602, 231.180735, 221.37533, 221.599907, 227.549131, 253.748345, 298.814285, 314.849974, 278.257246, 238.027022, 230.060962, 226.979844, 188.916412, 133.478482, 122.530209, 165.432817, 214.902846, 244.1499, 252.457483, 265.608949, 313.223013, 351.624834, 345.101572, 336.138916, 344.040885, 340.407409, 295.691144, 210.655549, 131.099956, 107.057573, 127.706512, 159.349848, 207.327289, 257.830372, 269.891128, 261.69678, 285.646918, 335.30148, 348.623595, 302.959905, 242.236018, 197.249141, 174.448102, 175.880321, 184.243467, 196.458902, 244.617532, 326.259686, 398.10641, 436.257574, 424.923586, 381.203215, 336.523564, 272.299392, 210.656486, 188.771208, 181.556015, 196.853153, 261.175135, 333.10415, 354.629083, 325.314939, 264.851262, 174.772503, 114.958188, 154.532373, 234.282501, 295.595379, 350.167583, 366.227657, 348.120013, 332.896467, 300.415903, 259.061868, 225.549391, 213.190992, 241.571616, 288.883877, 343.509153, 402.025596, 446.977819, 471.733545, 467.528373};





bool dsps_biquad_f32_ansi(float input[DATA_LEN], float output[DATA_LEN], float coef[5], float w[2]) {
    for (int i = 0; i < DATA_LEN; i++) {
        float d0 = input[i] - coef[3] * w[0] - coef[4] * w[1];
        output[i] = coef[0] * d0 + coef[1] * w[0] + coef[2] * w[1];
        w[1] = w[0];
        w[0] = d0;
    }
    return true;
}

void biquad(float rez[DATA_LEN]) {
    float in_data[DATA_LEN] = {0.0};
    float coef[5] = {0.0738017187,    0.1476034373,    0.0738017187,   -1.2505164146,    0.5457233191};
    float w[2] = {0.0};
    for (int i = 0; i < DATA_LEN; i++) {
        in_data[i] = DATA[i] * 2.15;
    }
    dsps_biquad_f32_ansi(in_data, rez, coef, w);
}

void benchmark_main() {
    float rez[DATA_LEN];
    biquad(rez);
    for (int i = 0; i < DATA_LEN; i++) {
        assert(fabsf(rez[i] - ANSWER[i]) < 0.0005);
    }
}
