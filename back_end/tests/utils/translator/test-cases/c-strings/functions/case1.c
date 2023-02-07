value_t func1(value_t i, value_t f) {
ROOT_SET(root_set, 2);
root_set.values[0] = i;
root_set.values[1] = f;
DELETE_ROOT_SET(root_set);
return int_to_value(2);
};
