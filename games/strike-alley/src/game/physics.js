import Matter from 'matter-js'
import { C } from './constants.js'

const { Engine, Bodies, Body, Composite } = Matter

// Top-down Matter.js world: gravity off, ball and pins are circles.
export function createPhysics() {
  const engine = Engine.create()
  engine.gravity.x = 0
  engine.gravity.y = 0

  const wallOpts = {
    isStatic: true,
    restitution: 0.3,
    collisionFilter: { category: C.CAT_WALL },
  }
  Composite.add(engine.world, [
    // side walls just outside the gutters
    Bodies.rectangle(-C.OUTER - 10, C.LANE_LENGTH / 2, 20, C.LANE_LENGTH * 2, wallOpts),
    Bodies.rectangle(C.OUTER + 10, C.LANE_LENGTH / 2, 20, C.LANE_LENGTH * 2, wallOpts),
    // back wall of the pit
    Bodies.rectangle(0, C.LANE_LENGTH + 10, C.OUTER * 4, 20, wallOpts),
  ])

  return engine
}

export function makeBallBody() {
  return Bodies.circle(0, C.BALL_START_DEPTH, C.BALL_R, {
    density: C.BALL_DENSITY,
    frictionAir: C.BALL_FRICTION_AIR,
    friction: 0.02,
    restitution: C.BALL_RESTITUTION,
    collisionFilter: {
      category: C.CAT_BALL,
      mask: C.CAT_WALL | C.CAT_PIN,
    },
  })
}

export function makePinBody(x, y) {
  return Bodies.circle(x, y, C.PIN_R, {
    density: C.PIN_DENSITY,
    frictionAir: C.PIN_FRICTION_AIR,
    friction: 0.05,
    restitution: C.PIN_RESTITUTION,
    collisionFilter: {
      category: C.CAT_PIN,
      mask: C.CAT_WALL | C.CAT_PIN | C.CAT_BALL,
    },
  })
}

export function resetBall(ball, startX = 0) {
  Body.setPosition(ball, { x: startX, y: C.BALL_START_DEPTH })
  Body.setVelocity(ball, { x: 0, y: 0 })
  Body.setAngularVelocity(ball, 0)
  ball.collisionFilter.mask = C.CAT_WALL | C.CAT_PIN
}

export function launchBall(ball, aim, speed) {
  Body.setVelocity(ball, {
    x: Math.sin(aim) * speed,
    y: Math.cos(aim) * speed,
  })
}

// Once in the gutter, the ball stays there and can't touch pins.
export function sendToGutter(ball, side) {
  ball.collisionFilter.mask = C.CAT_WALL
  Body.setPosition(ball, {
    x: side * (C.HALF_LANE + C.GUTTER_W / 2),
    y: ball.position.y,
  })
  Body.setVelocity(ball, { x: 0, y: ball.velocity.y })
}
