import {
  Box,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { Add as AddIcon, DeleteOutlined as DeleteIcon } from '@mui/icons-material'
import { tokens } from '../../theme'
import type { AudienceField, AudienceRule } from './useMessaging'

/**
 * "Everyone who has spent over ₹5,000 and has not ordered in 90 days."
 *
 * A row of three controls, repeated. Not a query language and not a free-text
 * box: the fields, their types and the operators each type allows all come from
 * `/messaging/catalogue`, so this component knows nothing about customers and a
 * field added on the server appears here without a release.
 *
 * The value control changes shape with the field — a date field with "in the
 * last" takes a number of days, a boolean takes yes/no, an enum takes its own
 * options — because a single text box is how someone types "ninety" into a
 * column that wanted 90.
 */
export function RuleBuilder({
  fields,
  rules,
  operator,
  onChange,
  onOperatorChange,
  disabled,
}: {
  fields: AudienceField[]
  rules: AudienceRule[]
  operator: 'all' | 'any'
  onChange: (rules: AudienceRule[]) => void
  onOperatorChange: (operator: 'all' | 'any') => void
  disabled?: boolean
}) {
  const byKey = new Map(fields.map((field) => [field.key, field]))

  function update(index: number, changes: Partial<AudienceRule>) {
    onChange(rules.map((rule, position) => (position === index ? { ...rule, ...changes } : rule)))
  }

  function valueControl(rule: AudienceRule, index: number) {
    const field = byKey.get(rule.field)
    const needsValue = field?.operators.find((option) => option.value === rule.operator)?.needs_value ?? true
    if (!field || !needsValue) return <Box sx={{ flex: 1 }} />

    if (rule.operator === 'in_last_days' || rule.operator === 'not_in_last_days') {
      return (
        <TextField
          size="small"
          type="number"
          label="Days"
          placeholder="30"
          sx={{ flex: 1 }}
          disabled={disabled}
          value={(rule.value as number) ?? ''}
          onChange={(event) => update(index, { value: Number(event.target.value) })}
        />
      )
    }

    if (field.type === 'boolean') {
      return (
        <FormControl size="small" sx={{ flex: 1 }} disabled={disabled}>
          <InputLabel id={`value-${index}`}>Value</InputLabel>
          <Select
            labelId={`value-${index}`}
            label="Value"
            value={String(rule.value ?? '1')}
            onChange={(event) => update(index, { value: event.target.value })}
          >
            <MenuItem value="1">Yes</MenuItem>
            <MenuItem value="0">No</MenuItem>
          </Select>
        </FormControl>
      )
    }

    if (field.options) {
      return (
        <FormControl size="small" sx={{ flex: 1 }} disabled={disabled}>
          <InputLabel id={`value-${index}`}>Value</InputLabel>
          <Select
            labelId={`value-${index}`}
            label="Value"
            value={String(rule.value ?? '')}
            onChange={(event) => update(index, { value: event.target.value })}
          >
            {field.options.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )
    }

    return (
      <TextField
        size="small"
        label="Value"
        placeholder={field.type === 'money' ? '5000' : field.type === 'date' ? '2026-01-31' : 'Value'}
        type={field.type === 'number' || field.type === 'money' ? 'number' : 'text'}
        sx={{ flex: 1 }}
        disabled={disabled}
        value={String(rule.value ?? '')}
        onChange={(event) => update(index, { value: event.target.value })}
      />
    )
  }

  return (
    <Stack spacing={1.5}>
      {rules.length > 1 && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography sx={{ fontSize: 13, color: tokens.subdued }}>Match</Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={operator}
            disabled={disabled}
            onChange={(_event, value) => value && onOperatorChange(value)}
          >
            <ToggleButton value="all">all of these</ToggleButton>
            <ToggleButton value="any">any of these</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      )}

      {rules.map((rule, index) => {
        const field = byKey.get(rule.field)
        return (
          <Stack key={index} direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: 'center' }}>
            <FormControl size="small" sx={{ flex: 1.4 }} disabled={disabled}>
              <InputLabel id={`field-${index}`}>Field</InputLabel>
              <Select
                labelId={`field-${index}`}
                label="Field"
                value={rule.field}
                onChange={(event) => {
                  const next = byKey.get(event.target.value)
                  update(index, {
                    field: event.target.value,
                    // The old operator may not apply to the new field's type.
                    operator: next?.operators[0]?.value ?? '=',
                    value: undefined,
                  })
                }}
              >
                {fields.map((option) => (
                  <MenuItem key={option.key} value={option.key}>
                    {option.label}
                    <Typography component="span" sx={{ fontSize: 11, color: tokens.faint, ml: 1 }}>
                      {option.group}
                    </Typography>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ flex: 1 }} disabled={disabled}>
              <InputLabel id={`operator-${index}`}>Is</InputLabel>
              <Select
                labelId={`operator-${index}`}
                label="Is"
                value={rule.operator}
                onChange={(event) => update(index, { operator: event.target.value })}
              >
                {(field?.operators ?? []).map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {valueControl(rule, index)}

            <IconButton
              size="small"
              disabled={disabled}
              aria-label="Remove this rule"
              onClick={() => onChange(rules.filter((_row, position) => position !== index))}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        )
      })}

      <Box>
        <Button
          size="small"
          startIcon={<AddIcon />}
          disabled={disabled}
          onClick={() =>
            onChange([...rules, { field: fields[0]?.key ?? 'total_spent', operator: fields[0]?.operators[0]?.value ?? '=', value: '' }])
          }
        >
          Add a rule
        </Button>
      </Box>
    </Stack>
  )
}
