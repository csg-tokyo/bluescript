volatile static value_t i = int_to_value(1);
while (value_to_int(i) < 1) {
i = int_to_value(value_to_int(i) + 1);
break;
};
