// Validation schemas for Student & Staff Authentication (FR-1, FR-2, NFR-6, NFR-12)
// Built with Zod

import { z } from 'zod'

// FR-1: Validate USN against university format for students (matches 01JST18CS001)
// Regex: ^[0-9]{2}[A-Z]{3}[0-9]{2}[A-Z]{2,3}[0-9]{3}$
export const USN_REGEX = /^[0-9]{2}[A-Z]{3}[0-9]{2}[A-Z]{2,3}[0-9]{3}$/

export const signupSchema = z.object({
  usn: z
    .string()
    .trim()
    .transform((val) => val.toUpperCase())
    .pipe(
      z
        .string()
        .regex(
          USN_REGEX,
          'Invalid USN format. Example: 01JST18CS001'
        )
    ),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters long'),
  name: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .optional()
    .or(z.literal('')),
})

// Part A.1: Validate only "not empty" and uppercase the ID so seeded staff (ADMIN01, COORD01, APPROV01) can log in
export const loginSchema = z.object({
  usn: z
    .string()
    .trim()
    .transform((val) => val.toUpperCase())
    .pipe(
      z
        .string()
        .min(1, 'USN or Staff ID is required')
    ),
  password: z.string().min(1, 'Password is required'),
})

export type SignupInput = z.infer<typeof signupSchema>
export type LoginInput = z.infer<typeof loginSchema>
