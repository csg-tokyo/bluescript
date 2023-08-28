TAG = "bounce"
WARMUP = 1
CYCLE = 4

RESULT = 1331

# random
class Random:
    def __init__(self):
        self._seed = 74755

    def next(self):
        self._seed = ((self._seed * 1309) + 13849) & 65535

        return self._seed


class Ball:
    def __init__(self, random):
        self._x = random.next() % 500
        self._y = random.next() % 500
        self._x_vel = (random.next() % 300) - 150
        self._y_vel = (random.next() % 300) - 150

    def bounce(self):
        x_limit = 500
        y_limit = 500
        bounced = False

        self._x += self._x_vel
        self._y += self._y_vel

        if self._x > x_limit:
            self._x = x_limit
            self._x_vel = -abs(self._x_vel)
            bounced = True

        if self._x < 0:
            self._x = 0
            self._x_vel = abs(self._x_vel)
            bounced = True

        if self._y > y_limit:
            self._y = y_limit
            self._y_vel = -abs(self._y_vel)
            bounced = True

        if self._y < 0:
            self._y = 0
            self._y_vel = abs(self._y_vel)
            bounced = True

        return bounced

def bounce():
    random = Random()

    ball_count = 100
    bounces = 0
    balls = [None] * ball_count

    for i in range(ball_count):
        balls[i] = Ball(random)

    for i in range(50):
        for ball in balls:
            if ball.bounce():
                bounces += 1
    return bounces            

def verify_result(result):
    return result == RESULT

def benchmark_main():
    result = bounce()
    verify_result(result)