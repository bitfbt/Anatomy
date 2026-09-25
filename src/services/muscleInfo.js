// Concise educational descriptions, independently phrased from:
// OpenStax A&P 2e §11.5 (groups and wrist actions):
// https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs
// NCBI Bookshelf NBK537229 (intrinsic hand muscles), NBK534772
// (interossei), NBK534876 (lumbricals), NBK536975 (forearm flexors),
// and NBK539784 (forearm extensors). No diagnostic claims are made.
const details = {
    'Thenar muscles': ['Muscle group', 'Thumb base', 'Move the thumb for opposition, bending and lifting away from the palm.'],
    'Hypothenar muscles': ['Muscle group', 'Little-finger side of palm', 'Move the little finger and help cup the palm around an object.'],
    'Lumbricals': ['Hand muscles', 'Palm, alongside finger tendons', 'Bend the knuckles while helping straighten the middle and end joints of the fingers.'],
    'Palmar interossei': ['Hand muscles', 'Between palm bones', 'Bring fingers toward the middle finger; also help bend knuckles and straighten finger joints.'],
    'Dorsal interossei': ['Hand muscles', 'Between hand bones', 'Spread fingers away from the middle finger; also assist knuckle bending and finger straightening.'],
    'Abductor pollicis brevis': ['Hand muscle', 'Thumb base', 'Lifts the thumb away from the plane of the palm.'],
    'Flexor pollicis brevis': ['Hand muscle', 'Thumb base', 'Bends the thumb at its knuckle.'],
    'Opponens pollicis': ['Hand muscle', 'Deep thumb base', 'Turns the thumb across the palm for opposition.'],
    'Adductor pollicis': ['Hand muscle', 'Deep palm', 'Pulls the thumb toward the hand for pinching.'],
    'Abductor digiti minimi': ['Hand muscle', 'Little-finger side of palm', 'Moves the little finger away from the ring finger.'],
    'Flexor digiti minimi brevis': ['Hand muscle', 'Little-finger base', 'Bends the little finger at its knuckle.'],
    'Opponens digiti minimi': ['Hand muscle', 'Deep little-finger base', 'Draws the fifth palm bone forward to cup the hand.'],
    'Forearm flexor group': ['Muscle group', 'Palm side of forearm', 'These muscles bend the wrist and fingers, transmitting force through long tendons.'],
    'Forearm extensor group': ['Muscle group', 'Back of forearm', 'These muscles straighten the wrist and fingers through tendons crossing the wrist.'],
    'Flexor digitorum profundus': ['Forearm muscle', 'Deep palm-side compartment', 'Bends the end joints of the four fingers.'],
    'Flexor digitorum superficialis': ['Forearm muscle', 'Palm-side compartment', 'Bends the middle joints of the four fingers.'],
    'Flexor pollicis longus': ['Forearm muscle', 'Deep palm-side compartment', 'Bends the thumb at its end joint.'],
    'Flexor carpi ulnaris': ['Forearm muscle', 'Little-finger side', 'Bends the wrist toward the palm and little-finger side.'],
    'Flexor carpi radialis': ['Forearm muscle', 'Palm-side compartment', 'Bends the wrist toward the palm and thumb side.'],
    'Palmaris longus': ['Forearm muscle', 'Palm-side compartment', 'Tightens the palm fascia and assists wrist bending. Some people lack this muscle.'],
    'Brachioradialis': ['Forearm muscle', 'Thumb side', 'Bends the elbow, especially with the hand in a handshake position.'],
    'Pronator teres': ['Forearm muscle', 'Upper palm-side compartment', 'Rotates the forearm so the palm turns downward.'],
    'Pronator quadratus': ['Forearm muscle', 'Deep forearm near wrist', 'Turns the palm downward and helps hold the radius and ulna together.'],
    'Extensor digitorum': ['Forearm muscle', 'Back compartment', 'Straightens the four fingers and assists wrist extension.'],
    'Extensor carpi ulnaris': ['Forearm muscle', 'Back, little-finger side', 'Extends the wrist and moves it toward the little-finger side.'],
    'Extensor digiti minimi': ['Forearm muscle', 'Back compartment', 'Helps straighten the little finger.'],
    'Extensor carpi radialis brevis': ['Forearm muscle', 'Back, thumb side', 'Extends the wrist and assists movement toward the thumb side.'],
    'Extensor carpi radialis longus': ['Forearm muscle', 'Thumb side', 'Extends the wrist and moves it toward the thumb side.'],
    'Abductor pollicis longus': ['Forearm muscle', 'Deep back compartment', 'Moves the thumb away from the hand at its base.'],
    'Extensor pollicis brevis': ['Forearm muscle', 'Deep back compartment', 'Straightens the thumb at its knuckle.'],
    'Extensor pollicis longus': ['Forearm muscle', 'Deep back compartment', 'Straightens the thumb at its end joint.'],
    'Anconeus': ['Elbow muscle', 'Back of elbow', 'Assists elbow straightening and steadies the joint.'],
    'Extensor hood': ['Tendon expansion', 'Back of finger knuckles', 'Receives tendon forces from forearm and hand muscles to coordinate finger-joint movement.'],
};

const flexors = ['Tendons', 'Palm side of wrist and fingers', 'Carry pulling force from forearm muscles to bend the fingers. Tendons connect muscles to bones.'];
const extensors = ['Tendons', 'Back of wrist and fingers', 'Carry pulling force from forearm muscles to straighten the fingers. Tendons connect muscles to bones.'];

export function getMuscleInfo(label) {
    if (typeof label !== 'string') return null;
    const name=label.replace(/ \(deep\)$/,'');
    let entry=details[name];
    if (['Flexor tendon paths','Flexor tendons'].includes(name)) entry=flexors;
    if (['Extensor tendon paths','Extensor tendons','Extensor digitorum tendons'].includes(name)) entry=extensors;
    if (name==='Extensor pollicis tendon') entry=['Tendon','Back of thumb','Carries force from the thumb extensors in the forearm to straighten the thumb.'];
    const digit=name.match(/^(Thumb|Index|Middle|Ring|Pinky) (flexor|extensor) tendon path$/);
    if (digit) entry=['Tendon',`${digit[1]} · ${digit[2]==='flexor'?'palm':'back'} side`,
        `Transmits force from forearm muscles to ${digit[2]==='flexor'?'bend':'straighten'} the ${digit[1]==='Pinky'?'little finger':digit[1]==='Thumb'?'thumb':`${digit[1].toLowerCase()} finger`}.`];
    if (!entry) return null;
    const [group,location,explanation]=entry;
    return {name:label,group,location,explanation};
}

export function muscleLabelTarget(label,rect) {
    const info=getMuscleInfo(label);
    return info ? {...info,id:`muscle-label-${label}`,type:'label',rect:{...rect}} : null;
}
