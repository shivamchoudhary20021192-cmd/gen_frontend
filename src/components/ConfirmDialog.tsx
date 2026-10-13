import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from '@mui/material'
import { useState, type ReactNode } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  body: ReactNode
  confirmLabel: string
  destructive?: boolean
  busy?: boolean
  /** Holds the confirm button back (a required choice not made yet) without locking Cancel. */
  confirmDisabled?: boolean
  /** When set, the confirm button stays disabled until this exact text is typed. */
  typeToConfirm?: string
  onConfirm(): void
  onClose(): void
}

/** "Are you sure?" for actions that cannot be taken back. */
export function ConfirmDialog({ open, title, body, confirmLabel, destructive, busy, confirmDisabled, typeToConfirm, onConfirm, onClose }: ConfirmDialogProps) {
  const [typed, setTyped] = useState('')
  const blocked = typeToConfirm !== undefined && typed.trim() !== typeToConfirm

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{ transition: { onExited: () => setTyped('') } }}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText component="div">{body}</DialogContentText>
        {typeToConfirm !== undefined && (
          <TextField
            label={`Type ${typeToConfirm} to confirm`}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoFocus
            fullWidth
            size="small"
            sx={{ mt: 2 }}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" color={destructive ? 'error' : 'primary'} onClick={onConfirm} disabled={busy || confirmDisabled || blocked}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
