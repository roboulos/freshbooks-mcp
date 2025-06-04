# 🎯 ENHANCED TDD IMPLEMENTATION PLAN - SNAPPY MCP 2.0

## 📋 CRITICAL GAPS TO ADDRESS

Based on your feedback, here are the specific areas that need implementation:

### 1. 🔴 Session Management Not Eliminating Parameters (Current Bug)
**Problem**: Tools still require `instance_name` and `workspace_id` even after `xano_set_context`
**Solution**: Modify ALL tool schemas to make these parameters `.optional()` and use session defaults

### 2. 🟠 XanoScript Conditionals & Control Flow
**Gap**: No clear examples of multi-line conditional logic
**Need**: Working patterns for if/else, nested conditions, complex branching

### 3. 🟠 Advanced Database Operations  
**Gap**: No examples for JOINs, GROUP BY, aggregations
**Need**: Query builder patterns and examples

### 4. 🟡 Debugging Capabilities
**Gap**: No way to inspect intermediate values
**Need**: debug.log implementation and execution tracing

## 🧪 TEST-DRIVEN DEVELOPMENT APPROACH

### Phase 1: Fix Session Management (Immediate - 2 hours)

#### Test Suite 1: Session Context Persistence
```typescript
// tests/session-context.test.ts
describe('Session Context Management', () => {
  it('should eliminate instance_name requirement after set_context', async () => {
    // Set context once
    await xano_set_context({ 
      instance_name: 'xnwv-v1z6-dvnr',
      workspace_id: 5 
    });
    
    // These should work WITHOUT parameters
    const tables = await xano_list_tables(); // No params!
    expect(tables).toBeDefined();
    expect(tables.error).toBeUndefined();
  });

  it('should auto-complete instance domains', async () => {
    await xano_set_context({ instance_name: 'xnwv-v1z6-dvnr' });
    const context = await xano_get_context();
    expect(context.instance).toBe('xnwv-v1z6-dvnr.n7c.xano.io');
  });

  it('should persist across multiple operations', async () => {
    await xano_set_context({ instance_name: 'xnwv-v1z6-dvnr', workspace_id: 5 });
    
    // Multiple operations without params
    await xano_list_tables();
    await xano_browse_table_content({ table: 'users' });
    await xano_get_table_schema({ table: 'users' });
    
    // All should succeed
  });
});
```

#### Implementation Steps:
1. Create `SessionInterceptor` class that wraps all tool handlers
2. Modify tool schemas: `instance_name: z.string().optional()`
3. Add session resolution logic to each tool
4. Test with real operations

### Phase 2: XanoScript Intelligence Layer (Day 1 - 4 hours)

#### Test Suite 2: XanoScript Conditionals
```typescript
// tests/xanoscript-conditionals.test.ts
describe('XanoScript Conditional Patterns', () => {
  it('should provide working if/else patterns', async () => {
    const result = await xano_get_pattern('conditional_logic');
    
    expect(result.patterns).toContain({
      simple_conditional: {
        pattern: '$result = $value > 100 ? "high" : "low"',
        explanation: 'Ternary operator for simple conditions'
      },
      multi_branch: {
        pattern: `
// Use nested ternaries for multiple conditions
$status = $score >= 90 ? "A" : 
          $score >= 80 ? "B" :
          $score >= 70 ? "C" : "F"`,
        explanation: 'Chain ternaries for multiple branches'
      },
      complex_logic: {
        pattern: `
// Combine with preconditions for complex flows
precondition ($user.active == true) {
  error = "User not active"
}

$can_purchase = $user.verified == true ? true : false
$discount = $user.tier == "premium" ? 0.2 : 0

precondition ($can_purchase == true) {
  error = "Purchase not allowed"
}`,
        explanation: 'Use preconditions for guards, ternaries for values'
      }
    });
  });

  it('should validate conditional syntax', async () => {
    const script = `
function check_eligibility {
  if ($age >= 18) {  // WRONG
    $eligible = true
  }
}`;
    
    const result = await xano_validate_script({ script, fix: true });
    
    expect(result.errors[0].message).toContain("Use ternary operator");
    expect(result.fixed_script).toContain('$eligible = $age >= 18 ? true : false');
  });
});
```

#### Test Suite 3: Database Query Patterns
```typescript
// tests/xanoscript-database.test.ts
describe('XanoScript Database Operations', () => {
  it('should provide JOIN examples', async () => {
    const result = await xano_get_pattern('database_joins');
    
    expect(result.examples.inner_join).toBe(`
// Method 1: Multiple queries with manual join
db.query "users" {
  where = {id: $user_id}
} as $user

db.query "orders" {
  where = {user_id: $user.id}
} as $orders

// Combine results
{
  user: $user,
  orders: $orders.items
} as $user_with_orders`);

    expect(result.examples.aggregation).toBe(`
// Get count and sum
db.query "orders" {
  where = {status: "completed"}
} as $completed_orders

$completed_orders.count as $total_orders
$completed_orders.items|map:"total"|sum as $total_revenue`);
  });

  it('should show GROUP BY alternatives', async () => {
    const result = await xano_get_pattern('database_grouping');
    
    expect(result.workaround).toContain('Use Xano addons or create custom functions');
    expect(result.alternative).toContain('Pre-aggregate in separate table');
  });
});
```

### Phase 3: Natural Language & Smart Defaults (Day 1 - 3 hours)

#### Test Suite 4: Natural Language Table Resolution
```typescript
// tests/natural-language.test.ts
describe('Natural Language Table References', () => {
  it('should resolve table names without IDs', async () => {
    await xano_set_context({ instance_name: 'test', workspace_id: 1 });
    
    // Should work with just table name
    const result = await xano_browse_table_content({ table: 'users' });
    expect(result.success).toBe(true);
  });

  it('should handle emoji-prefixed tables', async () => {
    // Table is actually "👤 users"
    const result = await xano_browse_table_content({ table: 'users' });
    expect(result._context.table_name).toBe('👤 users');
  });

  it('should fuzzy match table names', async () => {
    // Table is "workflow_users_staging"
    const result = await xano_browse_table_content({ table: 'workflow' });
    expect(result._context.suggestions).toContain('workflow_users_staging');
  });
});
```

### Phase 4: Debug & Development Tools (Day 2 - 4 hours)

#### Test Suite 5: Debugging Capabilities
```typescript
// tests/xanoscript-debug.test.ts
describe('XanoScript Debugging', () => {
  it('should show debug.log usage', async () => {
    const result = await xano_get_pattern('debugging');
    
    expect(result.examples.basic).toBe(`
debug.log {
  message = "Current user ID"
  data = $user.id
}`);

    expect(result.examples.complex).toBe(`
// Debug with multiple values
debug.log {
  message = "API Response Debug"
  data = {
    status: $response.status,
    headers: $response.headers,
    body: $response.body,
    timestamp: $current_time
  }
}`);
  });

  it('should trace execution flow', async () => {
    const result = await xano_debug_endpoint({ 
      endpoint_id: 123,
      trace: true 
    });
    
    expect(result.trace).toContainEqual({
      line: 5,
      operation: 'db.query',
      duration_ms: 23,
      result_preview: { count: 1 }
    });
  });
});
```

## 🏗️ IMPLEMENTATION ARCHITECTURE

### Core Components to Build:

#### 1. SessionAwareToolWrapper
```typescript
class SessionAwareToolWrapper {
  constructor(
    private toolHandler: Function,
    private toolName: string,
    private sessionManager: XanoSessionManager
  ) {}

  async execute(params: any) {
    // Auto-inject session defaults
    const enrichedParams = await this.enrichParams(params);
    
    try {
      const result = await this.toolHandler(enrichedParams);
      return this.wrapResponse(result);
    } catch (error) {
      return this.enhanceError(error);
    }
  }

  private async enrichParams(params: any) {
    const session = await this.sessionManager.getSession();
    
    // Add defaults if not provided
    if (!params.instance_name && session.instanceName) {
      params.instance_name = session.instanceName;
    }
    if (!params.workspace_id && session.workspaceId) {
      params.workspace_id = session.workspaceId;
    }
    
    // Resolve natural language references
    if (params.table && typeof params.table === 'string') {
      params.table_id = await this.resolveTableName(params.table);
    }
    
    return params;
  }
}
```

#### 2. XanoScriptPatternEngine
```typescript
class XanoScriptPatternEngine {
  private patterns = new Map<string, Pattern>();
  
  constructor() {
    this.loadCorePatterns();
    this.loadConditionalPatterns();
    this.loadDatabasePatterns();
    this.loadDebugPatterns();
  }
  
  private loadConditionalPatterns() {
    this.patterns.set('conditional_logic', {
      name: 'Conditional Logic Patterns',
      patterns: {
        ternary: {
          syntax: '$result = $condition ? $true_value : $false_value',
          example: '$status = $user.active ? "active" : "inactive"',
          explanation: 'Use ternary for value assignment'
        },
        multi_condition: {
          syntax: `$result = $cond1 ? $val1 :
                   $cond2 ? $val2 :
                   $cond3 ? $val3 : $default`,
          example: `$tier = $points >= 1000 ? "gold" :
                    $points >= 500 ? "silver" :
                    $points >= 100 ? "bronze" : "basic"`,
          explanation: 'Chain ternaries for multiple branches'
        },
        guards: {
          syntax: 'precondition (condition) { error = "message" }',
          example: `// Validate multiple conditions
precondition ($user.email != "") {
  error = "Email required"
}
precondition ($user.age >= 18) {
  error = "Must be 18 or older"
}
precondition ($user.verified == true) {
  error = "Email not verified"
}`,
          explanation: 'Use preconditions for validation guards'
        },
        complex_flow: {
          syntax: 'Combine preconditions and ternaries',
          example: `// Complex business logic
precondition ($order.total > 0) {
  error = "Order cannot be empty"
}

$shipping_method = $order.total >= 100 ? "free" : "standard"
$tax_rate = $customer.state == "CA" ? 0.0725 : 0

$final_total = $order.total + 
  ($shipping_method == "standard" ? 9.99 : 0) +
  ($order.total * $tax_rate)

precondition ($customer.balance >= $final_total) {
  error = "Insufficient funds"
}`,
          explanation: 'Real-world conditional flow'
        }
      }
    });
  }
}
```

#### 3. TableNameResolver
```typescript
class TableNameResolver {
  private cache = new Map<string, number>();
  
  async resolve(
    nameOrId: string | number, 
    session: XanoSession
  ): Promise<{ id: number; name: string }> {
    // Check cache first
    if (typeof nameOrId === 'string') {
      const cached = this.cache.get(nameOrId);
      if (cached) return { id: cached, name: nameOrId };
    }
    
    // Resolution strategies
    const strategies = [
      this.exactMatch,
      this.withoutEmoji,
      this.fuzzyMatch,
      this.smartSuggestion
    ];
    
    for (const strategy of strategies) {
      const result = await strategy(nameOrId, session);
      if (result) {
        this.cache.set(nameOrId, result.id);
        return result;
      }
    }
    
    throw new SmartError(
      `Table '${nameOrId}' not found`,
      'Check table name or use xano_list_tables',
      'Try: xano_search_tables({ pattern: "user" })',
      ['xano_list_tables', 'xano_search_tables']
    );
  }
}
```

## 📅 IMPLEMENTATION TIMELINE

### Day 0 (Today - 4 hours)
1. **Fix Session Management Bug** ✅
   - Make all parameters optional
   - Implement SessionAwareToolWrapper
   - Test with real API calls
   - Deploy and verify

2. **Create Test Infrastructure** ✅
   - Set up test environment
   - Create mock data
   - Write initial test suites

### Day 1 (8 hours)
1. **Morning: XanoScript Patterns** (4h)
   - Implement conditional patterns
   - Create database query examples
   - Build pattern engine
   - Test pattern retrieval

2. **Afternoon: Natural Language** (4h)
   - Implement TableNameResolver
   - Add fuzzy matching
   - Create smart suggestions
   - Test with various inputs

### Day 2 (8 hours)
1. **Morning: Advanced Features** (4h)
   - Debug capabilities
   - Query builder
   - Bulk operations
   - Transaction support

2. **Afternoon: Integration & Polish** (4h)
   - End-to-end testing
   - Performance optimization
   - Documentation
   - Demo preparation

## 🎯 SUCCESS METRICS

1. **Session Management**: 0 required parameters after context set
2. **Natural Language**: 95% table name resolution accuracy
3. **XanoScript Help**: <30s to find working pattern
4. **Error Recovery**: 100% of errors have actionable fixes
5. **Performance**: <100ms overhead per operation

## 🚀 IMMEDIATE NEXT STEPS

1. Clone the enhanced index.ts
2. Create test file for session management
3. Implement SessionAwareToolWrapper
4. Test one tool end-to-end
5. Deploy and verify the fix works

Ready to start implementation!