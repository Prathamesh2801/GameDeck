// Picture rounds about Zeal Interactive Services' own experiences
// (photos from zealinteractive.in). The first entry in `answers` is the
// correct option; the quiz shuffles them. `image` sits between the question
// text and the options.
const questions = [
  {
    id: 'q1',
    text: 'Which Zeal experience lets a car come alive through a tablet screen?',
    image: '/questions/ar-license-plate.jpg',
    answers: [
      'AR License Plate',
      'Facial Recognition',
      'Interactive Floor',
    ],
  },
  {
    id: 'q2',
    text: 'Which technology transports people into a fully virtual world?',
    image: '/questions/virtual-reality.jpg',
    answers: [
      'Virtual Reality',
      'Augmented Reality',
      'Gesture Technology',
    ],
  },
  {
    id: 'q3',
    text: 'Controlling a screen with hand movements alone is called…',
    image: '/questions/gesture-tech.jpg',
    answers: [
      'Gesture Based Technology',
      'Facial Recognition',
      'Sensor Floor',
    ],
  },
  {
    id: 'q4',
    text: 'This wall reacts the moment a guest touches it. What is it powered by?',
    image: '/questions/sensor-wall.jpg',
    answers: [
      'Sensor-Tech',
      'Virtual Reality',
      'AI Photobooth',
    ],
  },
  {
    id: 'q5',
    text: 'Which Zeal service registers event guests just by scanning their face?',
    image: '/questions/facial-recognition.jpg',
    answers: [
      'Facial Recognition',
      'QR Code Registration',
      'Gesture Technology',
    ],
  },
  {
    id: 'q6',
    text: 'Which Zeal experience turns a simple photo into a futuristic avatar?',
    image: '/questions/ai-photobooth.jpg',
    answers: [
      'AI Photobooth',
      'Rotoscope',
      'AR License Plate',
    ],
  },
  {
    id: 'q7',
    text: 'Projection plus sensors that react to footsteps make an…',
    image: '/questions/interactive-floor.jpg',
    answers: [
      'Interactive Floor',
      'Interactive Wall',
      'AR Table',
    ],
  },
  {
    id: 'q8',
    text: 'A miniature model that comes alive with digital content is an…',
    image: '/questions/ar-miniature-table.jpg',
    answers: [
      'AR Miniature Interactive Table',
      'Interactive Floor',
      'VR Experience Zone',
    ],
  },
  {
    id: 'q9',
    text: 'Which Zeal installation turns a brand wall into a touch-and-explore story?',
    image: '/questions/interactive-wall.jpg',
    answers: [
      'Interactive Wall',
      'Interactive Floor',
      'Robotic Arm',
    ],
  },
  {
    id: 'q10',
    text: 'Which Zeal brand-activation experience is shown in this booth?',
    image: '/questions/rotoscope.jpg',
    answers: [
      'Rotoscope',
      'VR Cricket',
      'Slingshot',
    ],
  },
  {
    id: 'q11',
    text: 'Physical objects on a table trigger 3D visuals on screen. What is this?',
    image: '/questions/ar-table.jpg',
    answers: [
      'AR Table',
      'Interactive Floor',
      'AI Photobooth',
    ],
  },
  {
    id: 'q12',
    text: 'Shooting hoops with digital effects layered on top is…',
    image: '/questions/ar-basketball.jpg',
    answers: [
      'Augmented Reality Basketball',
      'VR Cricket',
      'Kinect Based Games',
    ],
  },
  {
    id: 'q13',
    text: 'Which Zeal engagement game asks players to catch the right phrase?',
    image: '/questions/grab-the-words.jpg',
    answers: [
      'Grab the Words',
      'Cycle to Glow',
      'Slingshot',
    ],
  },
  {
    id: 'q14',
    text: 'Pedalling a bike to light up the screen is the Zeal game called…',
    image: '/questions/cycle-to-glow.jpg',
    answers: [
      'Cycle to Glow',
      'Grab the Words',
      'VR Cricket',
    ],
  },
];

// Images live in /public/questions. Prefix each with Vite's base URL so the
// paths resolve correctly when the app is deployed under a sub-path (e.g.
// /games/picture-perfect/) rather than the domain root.
export default questions.map((question) => ({
  ...question,
  image: `${import.meta.env.BASE_URL}${question.image.replace(/^\//, '')}`,
}));
