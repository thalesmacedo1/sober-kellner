import { pcSkill } from './pc'
import { systemSkill } from './system'
import { timersSkill } from './timers'
import type { Skill } from './types'

export const skills: Skill[] = [systemSkill, pcSkill, timersSkill]
