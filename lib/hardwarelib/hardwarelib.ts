import { integer, code } from "../utils";

function console_log_integer(n: integer) {
    code`
    int num_length = get_num_length(_n);
    char str[num_length + 1];
    snprintf(str, num_length, "%d", _n);
    push_log(str);
    printf("%d\n", _n);
    `
}