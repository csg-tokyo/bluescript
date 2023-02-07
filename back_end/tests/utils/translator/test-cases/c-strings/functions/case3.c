value_t func1(value_t i, value_t f) {
ROOT_SET(root_set, 3);
root_set.values[0] = i;
root_set.values[1] = f;
value_t a = int_to_value(3);
root_set.values[2] = a;
root_set.values[2] = int_to_value(value_to_int(root_set.values[2]) + value_to_int(root_set.values[0]));
DELETE_ROOT_SET(root_set);
return int_to_value(2);
};
