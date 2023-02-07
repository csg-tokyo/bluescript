int func1() {
    return 1;
}

int func2() {
    func1();
    return 2;
}

int main() {
    func2();
    return 3;
}