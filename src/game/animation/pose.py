"""
Pose helpers shared by every action (see actions/)

Actions are written in world terms on the standard skeleton (rig.py), never in bone-local terms,
so the same action works on any character rigged with build.py whatever its proportions.

Blender axes, model normalized to 1 m tall with the feet at the origin:
    X = character's right side, -Y = front, Z = up

Rotation signs around X: + leans the torso forward, - swings a hanging leg/arm forward, + bends the knee backward
Around Y: - raises the right arm sideways (use Pose.side to mirror), + rolls the torso toward its right
Around Z: + turns toward the character's right
"""
import math

from mathutils import Quaternion, Vector

X = Vector((1, 0, 0))
Y = Vector((0, 1, 0))
Z = Vector((0, 0, 1))


# Timing helpers, t is the clip progress 0..1

def wave(t, phase=0.0):
    return math.sin(2 * math.pi * (t + phase))


def cwave(t, phase=0.0):
    return math.cos(2 * math.pi * (t + phase))


def bump(t, center, width):
    """Smooth bell around center on a looping 0..1 timeline"""
    d = ((t - center + 0.5) % 1.0) - 0.5
    return math.exp(- (d / width) ** 2)


def smooth(start, end, t):
    """0 before start, 1 after end, smoothstep in between"""
    x = min(1.0, max(0.0, (t - start) / (end - start)))
    return x * x * (3 - 2 * x)


def arc(start, end, t):
    """0 > 1 > 0 between start and end (half sine)"""
    x = min(1.0, max(0.0, (t - start) / (end - start)))
    return math.sin(math.pi * x)


class Rig:
    """Rest data of the armature: bone heads, directions, lengths and parents in armature space"""
    def __init__(self, armature):
        self.armature = armature
        self.rest = {}
        self.head = {}
        self.tail = {}
        self.parent = {}
        self.length = {}
        for bone in armature.data.bones:
            self.rest[bone.name] = bone.matrix_local.to_quaternion()
            self.head[bone.name] = bone.head_local.copy()
            self.tail[bone.name] = bone.tail_local.copy()
            self.parent[bone.name] = bone.parent.name if bone.parent else None
            self.length[bone.name] = (bone.tail_local - bone.head_local).length

    def direction(self, bone):
        return (self.tail[bone] - self.head[bone]).normalized()


class Pose:
    """World axis rotations per bone (applied in the parent's posed frame) + world offsets (root only)"""
    def __init__(self, rig):
        self.rig = rig
        self.reset()

    def reset(self):
        self.rotations = {}
        self.offsets = {}

    def fresh(self):
        return Pose(self.rig)

    # Building

    def rotate(self, bone, axis, degrees):
        self.rotations[bone] = Quaternion(axis, math.radians(degrees)) @ self.rotations.get(bone, Quaternion())

    def side(self, bone, axis, degrees_right):
        """Same rotation on both sides, mirrored for the .L bone (X stays, Y and Z flip)"""
        self.rotate(bone + '.R', axis, degrees_right)
        self.rotate(bone + '.L', axis, degrees_right if axis is X else - degrees_right)

    def move(self, bone, offset):
        self.offsets[bone] = self.offsets.get(bone, Vector()) + Vector(offset)

    def mix(self, weight, a, b):
        """Replace the pose with pose function a blended toward pose function b"""
        pose_a = self.fresh()
        pose_b = self.fresh()
        if a:
            a(pose_a)
        if b:
            b(pose_b)
        for bone in set(pose_a.rotations) | set(pose_b.rotations):
            qa = pose_a.rotations.get(bone, Quaternion())
            qb = pose_b.rotations.get(bone, Quaternion())
            self.rotations[bone] = qa.slerp(qb, weight)
        for bone in set(pose_a.offsets) | set(pose_b.offsets):
            self.offsets[bone] = pose_a.offsets.get(bone, Vector()).lerp(pose_b.offsets.get(bone, Vector()), weight)

    # Forward kinematics (posed positions, used to aim limbs)

    def world_rotation(self, bone):
        parent = self.rig.parent[bone]
        parent_rotation = self.world_rotation(parent) if parent else Quaternion()
        return parent_rotation @ self.rotations.get(bone, Quaternion())

    def head(self, bone):
        parent = self.rig.parent[bone]
        if parent is None:
            return self.rig.head[bone] + self.offsets.get(bone, Vector())
        return self.head(parent) + self.world_rotation(parent) @ (self.rig.head[bone] - self.rig.head[parent])

    def tail(self, bone):
        return self.head(bone) + self.world_rotation(bone) @ (self.rig.tail[bone] - self.rig.head[bone])

    # Inverse kinematics

    def aim(self, bone, direction):
        """Rotate the bone so it points along a world direction"""
        parent = self.rig.parent[bone]
        parent_rotation = self.world_rotation(parent) if parent else Quaternion()
        wanted = parent_rotation.inverted() @ Vector(direction).normalized()
        self.rotations[bone] = self.rig.direction(bone).rotation_difference(wanted)

    def reach(self, upper, lower, target, pole):
        """Two bone IK: put the tail of lower on target, the middle joint bends toward pole (a world direction)"""
        target = Vector(target)
        start = self.head(upper)
        length1 = self.rig.length[upper]
        length2 = self.rig.length[lower]

        to_target = target - start
        distance = max(1e-4, min(to_target.length, (length1 + length2) * 0.999))
        direction = to_target.normalized()

        cos_angle = (length1 ** 2 + distance ** 2 - length2 ** 2) / (2 * length1 * distance)
        angle = math.acos(max(- 1.0, min(1.0, cos_angle)))

        bend = Vector(pole) - direction * Vector(pole).dot(direction)
        if bend.length < 1e-6:
            bend = direction.orthogonal()
        bend.normalize()

        joint = start + (direction * math.cos(angle) + bend * math.sin(angle)) * length1
        self.aim(upper, joint - start)
        self.aim(lower, start + direction * distance - joint)

    # Output

    def key(self, frame):
        for pose_bone in self.rig.armature.pose.bones:
            rest = self.rig.rest[pose_bone.name]
            world = self.rotations.get(pose_bone.name, Quaternion())
            pose_bone.rotation_mode = 'QUATERNION'
            pose_bone.rotation_quaternion = rest.inverted() @ world @ rest
            pose_bone.location = rest.inverted() @ self.offsets.get(pose_bone.name, Vector())
            pose_bone.keyframe_insert('rotation_quaternion', frame=frame)
            pose_bone.keyframe_insert('location', frame=frame)
