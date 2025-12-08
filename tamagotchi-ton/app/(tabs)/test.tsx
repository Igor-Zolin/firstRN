import { ThemedText } from '@/components/themed-text';
import Slider from '@react-native-community/slider';
import { Link } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Image } from 'expo-image';

export default function testPage() {
  const [pressCount, setPressCount] = useState(0);

  const handleValueChange = () => {
    setPressCount(prevCount => prevCount + 1);
  };
  return (
    <View style={styles.container}>
      <Text style={styles.basicText}>asdf</Text>
      <TouchableOpacity onPress={handleValueChange}>
        <Image
          source={require('@/assets/images/hole.png')}
          style={styles.holeImage}
          />
      </TouchableOpacity>
      <Text style={styles.basicText}>Value is { pressCount }</Text>
      <Slider
        minimumValue={0}
        maximumValue={100}
        value={ pressCount }
      />
      <Link href="/modals/testmodal">
        <ThemedText>Link to test modal page</ThemedText>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    top: 30,
    right: 0,
    bottom: 0,
    left: 15,
  },
  holeImage: {
    width: 350,
    height: 350*0.694,
  },
  basicText: {
    color: 'white',
  }
})

