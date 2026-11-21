// Validation schemas for Event Management (FR-4, FR-5, NFR-5)
import { z } from 'zod'
import { parseISTLocal } from '../datetime'

export const createEventSchema = z
  .object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters long'),
    description: z.string().trim().optional().or(z.literal('')),
    date_time: z
      .string()
      .min(1, 'Event date and time is required')
      .refine((val) => parseISTLocal(val) !== null, 'Enter a valid event date and time')
      .refine((val) => {
        const date = parseISTLocal(val)
        return date !== null && date.getTime() > Date.now()
      }, 'Event date and time must be scheduled in the future'),
    venue: z.string().trim().min(2, 'Venue is required (at least 2 characters)'),
    contact: z.string().trim().optional().or(z.literal('')),
    fee: z
      .coerce
      .number()
      .min(0, 'Fee must be free (0) or greater'),
    seat_limit: z
      .coerce
      .number()
      .int('Seat limit must be a whole number')
      .positive('Seat limit must be greater than 0'),
    registration_deadline: z
      .string()
      .min(1, 'Registration deadline is required')
      .refine((val) => parseISTLocal(val) !== null, 'Enter a valid registration deadline'),
  })
  .refine(
    (data) => {
      const eventDate = parseISTLocal(data.date_time)
      const deadlineDate = parseISTLocal(data.registration_deadline)
      // Invalid values are already reported by the field checks above
      if (!eventDate || !deadlineDate) return true
      return deadlineDate.getTime() <= eventDate.getTime()
    },
    {
      message: 'Registration deadline must be scheduled before or at the start of the event',
      path: ['registration_deadline'],
    }
  )

export type CreateEventInput = z.infer<typeof createEventSchema>
