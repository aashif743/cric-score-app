import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const StatsTable = ({ title, data, columns }) => {
  if (!data || data.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.emptyText}>No data yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.table}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          <Text style={[styles.headerCell, styles.rankCell]}>#</Text>
          <Text style={[styles.headerCell, styles.nameCell]}>Name</Text>
          {columns.map((col) => (
            <Text key={col.key} style={[styles.headerCell, styles.valueCell]}>
              {col.label}
            </Text>
          ))}
        </View>
        {/* Data Rows */}
        {data.map((item, index) => (
          <View
            key={item.name ? `${item.name}-${item.team || index}` : index}
            style={[styles.dataRow, index % 2 === 0 && styles.dataRowEven]}
          >
            <Text style={[styles.dataCell, styles.rankCell, styles.rankText]}>
              {index + 1}
            </Text>
            <View style={styles.nameCell}>
              <Text style={[styles.dataCell, styles.nameText]} numberOfLines={1}>
                {item.name}
              </Text>
              {item.team ? (
                <Text style={styles.teamText} numberOfLines={1}>{item.team}</Text>
              ) : null}
            </View>
            {columns.map((col) => (
              <Text key={col.key} style={[styles.dataCell, styles.valueCell, styles.valueText]}>
                {item[col.key] ?? '-'}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  table: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  headerCell: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dataRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  dataRowEven: {
    backgroundColor: '#f8fafc',
  },
  dataCell: {
    fontSize: 13,
    color: '#334155',
  },
  rankCell: {
    width: 28,
  },
  rankText: {
    fontWeight: '700',
    color: '#94a3b8',
  },
  nameCell: {
    flex: 1,
    justifyContent: 'center',
  },
  nameText: {
    fontWeight: '600',
  },
  teamText: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: 1,
  },
  valueCell: {
    width: 55,
    textAlign: 'right',
  },
  valueText: {
    fontWeight: '700',
    color: '#0f172a',
  },
});

export default StatsTable;
