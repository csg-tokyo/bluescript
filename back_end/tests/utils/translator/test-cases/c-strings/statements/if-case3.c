volatile static value_t i = int_to_value(1);
if (value_to_int(i) == 1) {
i = int_to_value(value_to_int(i) + 1);
} else if (value_to_int(i) == 2) {
i = int_to_value(value_to_int(i) + 3);
};
